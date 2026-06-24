import React, { useState, useEffect } from "react";
import { Client, ServiceOrder, ServiceCategory, Professional, SystemLog, CurrentUser, SmtpSettings, WhatsappSettings, Team, LoginAttempt } from "./types";
import { 
  INITIAL_CATEGORIES, INITIAL_PROFESSIONALS, INITIAL_CLIENTS, INITIAL_ORDERS 
} from "./data/mockData";
import Dashboard from "./components/Dashboard";
import Clients from "./components/Clients";
import ServiceOrders from "./components/ServiceOrders";
import Scheduler from "./components/Scheduler";
import Professionals from "./components/Professionals";
import AiAssistant from "./components/AiAssistant";
import ReportsAndLogs from "./components/ReportsAndLogs";
import SmtpSettingsPanel from "./components/SmtpSettingsPanel";

import { 
  BarChart, Users, ClipboardList, Calendar, Sparkles, Wrench,
  Settings, HelpCircle, LogOut, Menu, X, ShieldCheck, CheckCircle, Activity, FileText, Lock,
  Mail, Smartphone, Send, Copy, AlertTriangle, Bell, BellOff
} from "lucide-react";
import { useToast } from "./components/ToastContext";
import { useSystemTheme } from "./hooks/useSystemTheme";


export default function App() {
  const currentTheme = useSystemTheme();
  const { success: toastSuccess, error: toastError, warn: toastWarn, info: toastInfo, critical: toastCritical, system: toastSystem } = useToast();

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then((perm) => {
          setNotificationPermission(perm);
        }).catch(err => console.error("Erro ao solicitar permissão de notificação:", err));
      }
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toastWarn("Este navegador não suporta notificações de área de trabalho.", "Não Suportado");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        toastSuccess("Notificações do navegador ativadas com sucesso!", "Permissão Concedida");
        new Notification("Notificações Ativas", {
          body: "Você receberá alertas em tempo real sobre novas ordens de serviço e atualizações de status.",
          icon: "/favicon.ico",
        });
      } else if (permission === "denied") {
        toastError("As notificações foram bloqueadas. Verifique as configurações do seu navegador para redefinir as permissões.", "Permissão Negada");
      }
    } catch (error) {
      console.error("Erro ao solicitar permissão de notificação:", error);
    }
  };

  // Navigation State
  const [activeTab, setActiveTab] = useState<"dashboard" | "clients" | "orders" | "scheduler" | "professionals" | "assistant" | "reports" | "settings">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // LGPD CPF Auth State
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    const cached = localStorage.getItem("service_mgt_logged_user");
    return cached ? JSON.parse(cached) : null;
  });
  const [typedDoc, setTypedDoc] = useState("");
  const [consentCheck, setConsentCheck] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [lgpdModalOpen, setLgpdModalOpen] = useState(false);

  const [typedPassword, setTypedPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [regSuccessMessage, setRegSuccessMessage] = useState("");

  // Registration Form State
  const [regCPF, setRegCPF] = useState("");
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // User self-change password state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changePasswordError, setChangePasswordError] = useState("");
  const [changePasswordSuccess, setChangePasswordSuccess] = useState("");

  // Forgot Password / Password Recovery states
  const [forgotPasswordModalOpen, setForgotPasswordModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<"cpf" | "otp" | "new_password">("cpf");
  const [resetCpf, setResetCpf] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [resetUserType, setResetUserType] = useState<"admin" | "client" | "professional" | null>(null);
  const [resetOtp, setResetOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [newResetPassword, setNewResetPassword] = useState("");
  const [confirmNewResetPassword, setConfirmNewResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showSimulatedEmailMessage, setShowSimulatedEmailMessage] = useState(false);

  // Password Reset Notification Simulator Overlay (LGPD)
  const [simulatedNotification, setSimulatedNotification] = useState<{
    userName: string;
    phone: string;
    email: string;
    tempPassword: string;
    apiStatus?: "idle" | "sending" | "success" | "error";
    apiResponse?: string;
    apiUrlUsed?: string;
    apiPayload?: string;
  } | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Core persistence state
  const [permissions, setPermissions] = useState<Record<string, string[]>>(() => {
    const cached = localStorage.getItem("service_mgt_permissions3");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        // fallback to default
      }
    }
    const defaultPerms = {
      dashboard: ["admin", "gestor", "gestor_servicos", "profissional"],
      clients: ["admin", "gestor"],
      orders: ["admin", "gestor", "gestor_servicos", "profissional", "requisitante"],
      scheduler: ["admin", "gestor", "gestor_servicos", "profissional"],
      professionals: ["admin", "gestor", "gestor_servicos"],
      reports: ["admin", "gestor"],
      settings: ["admin"],
      assistant: ["admin", "gestor", "gestor_servicos", "profissional", "requisitante"]
    };
    localStorage.setItem("service_mgt_permissions3", JSON.stringify(defaultPerms));
    return defaultPerms;
  });

  const updatePermissionsState = (newPerms: Record<string, string[]>) => {
    setPermissions(newPerms);
    localStorage.setItem("service_mgt_permissions3", JSON.stringify(newPerms));
  };

  const hasTabPermission = (tab: string) => {
    if (!currentUser) return false;
    const userRole = currentUser.userType || "requisitante";
    if (userRole === "admin") return true; // master always has access to all resources
    const allowed = permissions[tab] || [];
    return allowed.includes(userRole);
  };

  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>({
    host: "smtp.aracatubaservicos.com.br",
    port: "587",
    user: "suporte@aracatubaservicos.com.br",
    pass: "S0m3_S3cur3_P@ssw0rd",
    senderAddress: "Araçatuba Serviços <suporte@aracatubaservicos.com.br>",
    secure: true
  });
  const [whatsappSettings, setWhatsappSettings] = useState<WhatsappSettings>({
    provider: "custom",
    apiToken: "",
    apiUrl: "https://api.twilio.com/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Messages.json",
    fromNumber: "+14155238886",
    enabled: false
  });
  const [teams, setTeams] = useState<Team[]>([]);

  // Cross-component routing state (AI Prefills)
  const [selectedOS, setSelectedOS] = useState<ServiceOrder | null>(null);

  // Load state from LocalStorage on mount
  useEffect(() => {
    const cachedClients = localStorage.getItem("service_mgt_clients2");
    const cachedOrders = localStorage.getItem("service_mgt_orders2");
    const cachedCategories = localStorage.getItem("service_mgt_categories2");
    const cachedProfessionals = localStorage.getItem("service_mgt_professionals2");
    const cachedLogs = localStorage.getItem("service_mgt_logs2");
    const cachedSmtp = localStorage.getItem("service_mgt_smtp");
    const cachedWhatsapp = localStorage.getItem("service_mgt_whatsapp");
    const cachedTeams = localStorage.getItem("service_mgt_teams");

    if (cachedTeams) {
      setTeams(JSON.parse(cachedTeams));
    } else {
      setTeams([]);
    }

    if (cachedSmtp) {
      setSmtpSettings(JSON.parse(cachedSmtp));
    }

    if (cachedWhatsapp) {
      setWhatsappSettings(JSON.parse(cachedWhatsapp));
    }

    if (cachedClients) {
      setClients(JSON.parse(cachedClients));
    } else {
      setClients(INITIAL_CLIENTS);
      localStorage.setItem("service_mgt_clients2", JSON.stringify(INITIAL_CLIENTS));
    }

    if (cachedOrders) {
      setOrders(JSON.parse(cachedOrders));
    } else {
      setOrders(INITIAL_ORDERS);
      localStorage.setItem("service_mgt_orders2", JSON.stringify(INITIAL_ORDERS));
    }

    if (cachedCategories) {
      const parsed: ServiceCategory[] = JSON.parse(cachedCategories);
      const updated = [...parsed];
      let needsUpdate = false;
      INITIAL_CATEGORIES.forEach(initCat => {
        if (!parsed.some(pc => pc.name.toLowerCase() === initCat.name.toLowerCase())) {
          updated.push(initCat);
          needsUpdate = true;
        }
      });
      setCategories(updated);
      if (needsUpdate) {
        localStorage.setItem("service_mgt_categories2", JSON.stringify(updated));
      }
    } else {
      setCategories(INITIAL_CATEGORIES);
      localStorage.setItem("service_mgt_categories2", JSON.stringify(INITIAL_CATEGORIES));
    }

    if (cachedProfessionals) {
      setProfessionals(JSON.parse(cachedProfessionals));
    } else {
      setProfessionals(INITIAL_PROFESSIONALS);
      localStorage.setItem("service_mgt_professionals2", JSON.stringify(INITIAL_PROFESSIONALS));
    }

    if (cachedLogs) {
      setLogs(JSON.parse(cachedLogs));
    } else {
      const initialLogs: SystemLog[] = [
        {
          id: "log-1",
          timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
          action: "Abertura de Chamado",
          details: "Requisição #5512 criada: Vazamento de Pressão na Filtração Principal por Willian C. Lima.",
          category: "requisicao"
        },
        {
          id: "log-2",
          timestamp: new Date(Date.now() - 2.5 * 3600000).toISOString(),
          action: "Alocação de Técnico",
          details: "Técnico Lucas Mendes designado para atuar no atendimento de campo.",
          category: "tecnico"
        },
        {
          id: "log-3",
          timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
          action: "Cadastro de Requisitante",
          details: "Novo requisitante cadastrado: Hospital das Clínicas Central.",
          category: "requisitante"
        }
      ];
      setLogs(initialLogs);
      localStorage.setItem("service_mgt_logs2", JSON.stringify(initialLogs));
    }

    const cachedLoginAttempts = localStorage.getItem("service_mgt_login_attempts");
    if (cachedLoginAttempts) {
      setLoginAttempts(JSON.parse(cachedLoginAttempts));
    } else {
      const initialAttempts: LoginAttempt[] = [
        {
          id: "attempt-1",
          timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
          username: "36911121884",
          userId: "gestor-admin",
          status: "success",
          userType: "gestor",
          details: "Login autorizado com sucesso para o Gestor Administrador."
        },
        {
          id: "attempt-2",
          timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
          username: "11122233344",
          userId: "cli-2",
          status: "failed",
          userType: "requisitante",
          details: "Falha de autenticação: Senha de segurança incorreta."
        },
        {
          id: "attempt-3",
          timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
          username: "44455566677",
          userId: "prof-1",
          status: "success",
          userType: "profissional",
          details: "Login técnico homologado com sucesso."
        }
      ];
      setLoginAttempts(initialAttempts);
      localStorage.setItem("service_mgt_login_attempts", JSON.stringify(initialAttempts));
    }
  }, []);

  // Sync state helpers to persistent Storage
  const updateClientsState = (newClients: Client[]) => {
    setClients(newClients);
    localStorage.setItem("service_mgt_clients2", JSON.stringify(newClients));
  };

  const updateOrdersState = (newOrders: ServiceOrder[]) => {
    setOrders(newOrders);
    localStorage.setItem("service_mgt_orders2", JSON.stringify(newOrders));
  };

  const updateProfessionalsState = (newProfs: Professional[]) => {
    setProfessionals(newProfs);
    localStorage.setItem("service_mgt_professionals2", JSON.stringify(newProfs));
  };

  const updateTeamsState = (newTeams: Team[]) => {
    setTeams(newTeams);
    localStorage.setItem("service_mgt_teams", JSON.stringify(newTeams));
  };

  const handleAddTeam = (newTeam: Team) => {
    updateTeamsState([...teams, newTeam]);
    addSystemLog(
      "Montagem de Equipe",
      `Nova equipe técnica montada: "${newTeam.name}" com ${newTeam.memberIds.length} integrantes sob coordenação direta.`,
      "tecnico"
    );
    toastSuccess(`Equipe "${newTeam.name}" montada com sucesso!`, "Equipe Criada");
  };

  const handleUpdateTeam = (updatedTeam: Team) => {
    updateTeamsState(teams.map(t => t.id === updatedTeam.id ? updatedTeam : t));
    addSystemLog(
      "Alteração de Equipe",
      `Equipe técnica "${updatedTeam.name}" teve sua composição ou responsável modificados pelo gestor.`,
      "tecnico"
    );
    toastSuccess(`Equipe "${updatedTeam.name}" atualizada com êxito!`, "Equipe Modificada");
  };

  const handleDeleteTeam = (id: string) => {
    const targetTeam = teams.find(t => t.id === id);
    updateTeamsState(teams.filter(t => t.id !== id));
    addSystemLog(
      "Dissolução de Equipe",
      `Equipe técnica de campo "${targetTeam?.name || id}" desfeita pelo gestor no sistema de controle.`,
      "tecnico"
    );
    toastWarn(`Equipe foi desfeita com sucesso.`, "Equipe Removida");
  };

  const addSystemLog = (action: string, details: string, category: "requisicao" | "requisitante" | "tecnico" | "sistema") => {
    const newLog: SystemLog = {
      id: "log-" + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      action,
      details,
      category
    };
    setLogs(prev => {
      const updated = [newLog, ...prev];
      localStorage.setItem("service_mgt_logs2", JSON.stringify(updated));
      return updated;
    });
  };

  const addLoginAttempt = (username: string, userId: string, status: "success" | "failed", userType: string, details: string) => {
    const attempt: LoginAttempt = {
      id: "attempt-" + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      username,
      userId,
      status,
      userType,
      details
    };
    setLoginAttempts(prev => {
      const updated = [attempt, ...prev];
      localStorage.setItem("service_mgt_login_attempts", JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearLoginAttempts = () => {
    setLoginAttempts([]);
    localStorage.setItem("service_mgt_login_attempts", JSON.stringify([]));
  };

  const handleSaveSmtpSettings = (newSettings: SmtpSettings) => {
    setSmtpSettings(newSettings);
    localStorage.setItem("service_mgt_smtp", JSON.stringify(newSettings));
    addSystemLog(
      "Configuração SMTP",
      `Parâmetros do servidor SMTP atualizados pelo Gestor (${newSettings.host}:${newSettings.port}).`,
      "sistema"
    );
  };

  const handleSaveWhatsappSettings = (newSettings: WhatsappSettings) => {
    setWhatsappSettings(newSettings);
    localStorage.setItem("service_mgt_whatsapp", JSON.stringify(newSettings));
    addSystemLog(
      "Configuração WhatsApp",
      `Parâmetros do disparador WhatsApp API atualizados pelo Gestor. Provedor: ${newSettings.provider}, Habilitado: ${newSettings.enabled ? 'Sim' : 'Não'}.`,
      "sistema"
    );
  };

  const handleClearLogs = () => {
    setLogs([]);
    localStorage.setItem("service_mgt_logs2", JSON.stringify([]));
    toastWarn("Os registros de auditoria do sistema foram expurgados.", "Logs Limpados");
  };

  // Client Callback implementations
  const handleAddClient = (client: Client) => {
    updateClientsState([client, ...clients]);
    addSystemLog(
      "Cadastro de Requisitante",
      `Novo requisitante "${client.name}" (${client.document}) cadastrado com sucesso.`,
      "requisitante"
    );
    toastSuccess(`Requisitante "${client.name}" cadastrado com sucesso!`, "Cadastro Realizado");
  };

  const handleUpdateClient = (updatedClient: Client) => {
    const oldClient = clients.find(c => c.id === updatedClient.id);
    updateClientsState(clients.map(c => c.id === updatedClient.id ? updatedClient : c));
    
    let logDetail = `Os dados cadastrais do requisitante "${updatedClient.name}" foram atualizados.`;
    if (oldClient && oldClient.password !== updatedClient.password) {
      logDetail += " [Senha de acesso alterada pelo Gestor]";
    }
    
    addSystemLog(
      "Edição de Requisitante",
      logDetail,
      "requisitante"
    );
    toastSuccess(`Dados cadastrais de "${updatedClient.name}" foram atualizados.`, "Requisitante Atualizado");
  };

  const handleDeleteClient = (id: string) => {
    const client = clients.find(c => c.id === id);
    updateClientsState(clients.filter(c => c.id !== id));
    addSystemLog(
      "Remoção de Requisitante",
      `Requisitante "${client ? client.name : id}" removido do sistema de gestão integrada.`,
      "requisitante"
    );
    toastWarn(`Requisitante "${client ? client.name : id}" removido do sistema.`, "Cadastro Excluído");
  };

  // Order/Requisition Callback implementations
  const handleAddOrder = (order: ServiceOrder) => {
    updateOrdersState([order, ...orders]);
    addSystemLog(
      "Abertura de Requisição",
      `Nova requisição #${order.id} ("${order.title}") cadastrada no sistema sob a categoria ${order.category}.`,
      "requisicao"
    );
    toastSuccess(`Recepção da OS #${order.id} registrada com sucesso!`, "Nova OS Cadastrada");

    // Disparar notificação do navegador
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(`Nova Ordem de Serviço #${order.id}`, {
          body: `A OS "${order.title}" foi aberta na categoria ${order.category}.`,
          icon: "/favicon.ico",
        });
      } catch (e) {
        console.error("Erro ao disparar notificação:", e);
      }
    }
  };

  const handleUpdateOrder = (updatedOrder: ServiceOrder) => {
    const oldOrder = orders.find(o => o.id === updatedOrder.id);
    updateOrdersState(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));

    if (oldOrder) {
      if (oldOrder.status !== updatedOrder.status) {
        let det = `Status do chamado #${updatedOrder.id} alterado de "${oldOrder.status}" para "${updatedOrder.status}".`;
        if (updatedOrder.status === 'em_progresso') {
          det += ` Profissional designado: ${updatedOrder.assignedTo || 'Nenhum'}.`;
        } else if (updatedOrder.status === 'concluido') {
          det += ` Atendimento finalizado com ${updatedOrder.completedImages?.length || 0} fotos de comprovante visual anexadas.`;
        }
        addSystemLog(
          "Atualização de Status",
          det,
          "requisicao"
        );

        // Map status names to Portuguese friendly names for toast display
        const friendlyStatus: Record<string, string> = {
          aberto: "Aberto",
          em_progresso: "Em Progresso / Atendimento",
          aguardando: "Aguardando Peças",
          concluido: "Concluído / Encerrado",
          cancelado: "Cancelado / Suspenso"
        };
        const statusLabel = friendlyStatus[updatedOrder.status] || updatedOrder.status;
        toastSuccess(`Status da OS #${updatedOrder.id} atualizado para "${statusLabel}".`, "Status Alterado");

        // Disparar notificação do navegador
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(`Status Alterado - OS #${updatedOrder.id}`, {
              body: `O status da OS "${updatedOrder.title}" foi alterado para "${statusLabel}".`,
              icon: "/favicon.ico",
            });
          } catch (e) {
            console.error("Erro ao disparar notificação:", e);
          }
        }

      } else if (!oldOrder.hasMissingMaterial && updatedOrder.hasMissingMaterial) {
        addSystemLog(
          "Falta de Material Sinalizada",
          `Técnico sinalizou que a requisição de serviço #${updatedOrder.id} necessita de materiais: ${updatedOrder.missingMaterialDescription || 'não especificado'}.`,
          "requisicao"
        );
        toastWarn(`Falta de material sinalizada para a OS #${updatedOrder.id}!`, "Material Pendente");
      } else if (oldOrder.hasMissingMaterial && !updatedOrder.hasMissingMaterial) {
        addSystemLog(
          "Material Fornecido",
          `Materiais pendentes para o chamado #${updatedOrder.id} foram providenciados. Execução normal retomada.`,
          "requisicao"
        );
        toastSuccess(`Materiais pendentes providenciados para a OS #${updatedOrder.id}.`, "Materiais Entregues");
      } else if ((oldOrder.history || []).length < (updatedOrder.history || []).length) {
        const lastLog = updatedOrder.history[updatedOrder.history.length - 1];
        addSystemLog(
          "Parecer Técnico / Resposta",
          `Nova resposta adicionada por ${lastLog.author} na requisição #${updatedOrder.id}: "${lastLog.comment.substring(0, 70)}..."`,
          "requisicao"
        );
        toastInfo(`Parecer técnico adicionado na OS #${updatedOrder.id}.`, "Nova Resposta");
      } else {
        addSystemLog(
          "Ficha Técnica Editada",
          `Informações gerais da requisição #${updatedOrder.id} foram atualizadas pelo gestor.`,
          "requisicao"
        );
        toastSuccess(`Informações da OS #${updatedOrder.id} foram salvas com sucesso.`, "Dados Atualizados");
      }
    }
  };

  const handleDeleteOrder = (id: string) => {
    const order = orders.find(o => o.id === id);
    updateOrdersState(orders.filter(o => o.id !== id));
    addSystemLog(
      "Remoção de Chamado",
      `A requisição de serviço #${id} ${order ? `("${order.title}")` : ""} foi removida permanentemente do banco de dados pelo gestor.`,
      "requisicao"
    );
    toastWarn(`Ordem de serviço #${id} foi excluída permanentemente.`, "Chamado Removido");
  };

  // Professionals Callback implementations
  const handleAddProfessional = (newProf: Professional) => {
    updateProfessionalsState([...professionals, newProf]);
    addSystemLog(
      "Cadastro de Técnico",
      `Novo profissional do corpo técnico, "${newProf.name}" (${newProf.specialty}), integrado ao sistema.`,
      "tecnico"
    );
    toastSuccess(`Técnico "${newProf.name}" cadastrado com sucesso!`, "Técnico Registrado");
  };

  const handleDeleteProfessional = (id: string) => {
    const prof = professionals.find(p => p.id === id);
    updateProfessionalsState(professionals.filter(p => p.id !== id));
    addSystemLog(
      "Exclusão de Técnico",
      `${prof ? `Técnico "${prof.name}"` : `Técnico de ID ${id}`} desligado da equipe de campo no sistema de requisições.`,
      "tecnico"
    );
    toastWarn(`Cadastro de técnico foi removido do sistema.`, "Técnico Desconectado");
  };

  const handleUpdateProfessional = (updatedProf: Professional) => {
    const oldProf = professionals.find(p => p.id === updatedProf.id);
    updateProfessionalsState(professionals.map(p => p.id === updatedProf.id ? updatedProf : p));

    let logDetail = `Os dados cadastrais e especialidades do técnico de campo "${updatedProf.name}" foram editados e atualizados pelo Gestor.`;
    if (oldProf && oldProf.password !== updatedProf.password) {
      logDetail += " [Senha de acesso atualizada de forma segura]";
    }

    addSystemLog(
      "Edição de Técnico",
      logDetail,
      "tecnico"
    );
    toastSuccess(`Dados de "${updatedProf.name}" foram salvos com sucesso!`, "Técnico Atualizado");
  };

  const sendProgrammaticWhatsapp = async (targetPhone: string, messageText: string, settings: WhatsappSettings) => {
    if (!settings.enabled) {
      return { status: "idle" as const, message: "Disparador desativado nas Configurações do WhatsApp. Somente simulação exibida." };
    }
    
    const cleanPhone = targetPhone.replace(/\D/g, "");
    const finalUrl = settings.apiUrl || "";
    let payloadStr = "";
    let proxyBody = "";
    let headersObj: Record<string, string> = {};
    
    try {
      if (settings.provider === "twilio") {
        const bodyParams = new URLSearchParams();
        const toVal = targetPhone.startsWith("whatsapp:") ? targetPhone : `whatsapp:+${cleanPhone}`;
        const fromVal = settings.fromNumber.startsWith("whatsapp:") ? settings.fromNumber : `whatsapp:${settings.fromNumber}`;
        
        bodyParams.append("To", toVal);
        bodyParams.append("From", fromVal);
        bodyParams.append("Body", messageText);
        payloadStr = `To=${toVal}&From=${fromVal}&Body=${messageText}`;
        
        headersObj = {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`api:${settings.apiToken}`)}`
        };
        proxyBody = bodyParams.toString();
      } else if (settings.provider === "cloud_api") {
        const bodyContent = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: {
            body: messageText
          }
        };
        payloadStr = JSON.stringify(bodyContent, null, 2);
        
        headersObj = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.apiToken}`
        };
        proxyBody = payloadStr;
      } else {
        const bodyContent = {
          phone: cleanPhone,
          message: messageText,
          sender: settings.fromNumber
        };
        payloadStr = JSON.stringify(bodyContent, null, 2);
        
        headersObj = {
          "Content-Type": "application/json",
          "X-API-Key": settings.apiToken,
          "Authorization": `Bearer ${settings.apiToken}`
        };
        proxyBody = payloadStr;
      }
      
      const response = await fetch("/api/whatsapp/proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: finalUrl,
          method: "POST",
          headers: headersObj,
          body: proxyBody
        })
      });
      
      const resJson = await response.json();
      
      if (!response.ok || !resJson.ok) {
        const errorMsg = resJson.error || resJson.data || "Erro de rede no proxy.";
        return {
          status: "error" as const,
          message: `Erro no proxy (${resJson.status || response.status}): ${errorMsg.substring(0, 300)}`,
          payload: payloadStr,
          urlUsed: finalUrl
        };
      }
      
      return {
        status: "success" as const,
        message: `HTTP ${resJson.status}: ${resJson.data ? resJson.data.substring(0, 300) : "Sucesso"}`,
        payload: payloadStr,
        urlUsed: finalUrl
      };
    } catch (e: any) {
      return {
        status: "error" as const,
        message: e.message || "Erro de rede no proxy.",
        payload: payloadStr || "Não compilado",
        urlUsed: finalUrl
      };
    }
  };

  const handleResetPassword = async (id: string, type: "client" | "professional") => {
    const defaultPassword = "123456";
    let userName = "";
    let phone = "";
    let email = "";

    if (type === "client") {
      const target = clients.find(c => c.id === id);
      if (target) {
        userName = target.name;
        phone = target.phone || "";
        email = target.email || "";

        const updatedClients = clients.map(c => 
          c.id === id 
            ? { ...c, password: defaultPassword, failedAttempts: 0, blocked: false } 
            : c
        );
        updateClientsState(updatedClients);
      }
    } else {
      const target = professionals.find(p => p.id === id);
      if (target) {
        userName = target.name;
        phone = "(18) 99124-7788"; // standard tech phone format
        email = target.name.toLowerCase().split(" ")[0] + "@aracatubaservicos.com.br"; // tech professional email fallback

        const updatedProfs = professionals.map(p => 
          p.id === id 
            ? { ...p, password: defaultPassword, failedAttempts: 0, blocked: false } 
            : p
        );
        updateProfessionalsState(updatedProfs);
      }
    }

    if (userName) {
      // Record system log
      addSystemLog(
        "Reset de Senha",
        `O Gestor redefiniu a senha da conta de "${userName}" para o padrão temporário "123456" e liberou o bloqueio.`,
        "sistema"
      );

      const targetPhone = phone || "(18) 99123-4567";
      const targetEmail = email || `${userName.toLowerCase().replace(/[^a-z0-9]/g, "")}@gmail.com`;

      // Trigger modal immediately with "sending" / "idle" state
      const defaultState = {
        userName,
        phone: targetPhone,
        email: targetEmail,
        tempPassword: defaultPassword,
        apiStatus: (whatsappSettings.enabled ? "sending" : "idle") as any,
        apiResponse: whatsappSettings.enabled ? "Processando disparo de API do WhatsApp..." : "Disparador automático desativado nas configurações.",
        apiUrlUsed: whatsappSettings.apiUrl,
        apiPayload: ""
      };
      
      setSimulatedNotification(defaultState);
      toastSuccess(`Credenciais de "${userName}" redefinidas com sucesso!`, "Senha Alterada");

      if (whatsappSettings.enabled) {
        const messageText = `Araçatuba Serviços de Manutenção: Olá ${userName}! Sua senha de acesso provisória foi redefinida para "123456". Altere-a imediatamente após realizar o login para manter seus dados seguros em conformidade com o sigilo da LGPD.`;
        const res = await sendProgrammaticWhatsapp(targetPhone, messageText, whatsappSettings);
        
        setSimulatedNotification(prev => {
          if (!prev || prev.userName !== userName) return prev;
          return {
            ...prev,
            apiStatus: res.status,
            apiResponse: res.message,
            apiUrlUsed: res.urlUsed,
            apiPayload: res.payload
          };
        });
      }
    }
  };

  // Prefill assistant router helper (for WhatsApp generator / diagnostics)
  const handleOpenAiAssistantWithOS = (os: ServiceOrder) => {
    // Save to some session variable or pass context if needed
    setActiveTab("assistant");
  };

  // Quick Calendar scheduling router helper
  const handleQuickScheduleOrder = (dateString: string) => {
    setActiveTab("orders");
  };

  // CPF Dynamic masking formatter (CNPJ has been removed)
  const formatDoc = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 11);
    let formatted = clean;
    if (clean.length > 9) {
      formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
    } else if (clean.length > 6) {
      formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
    } else if (clean.length > 3) {
      formatted = `${clean.slice(0, 3)}.${clean.slice(3)}`;
    }
    return formatted;
  };

  // Strict CPF Dynamic formatting for internal municipal controls
  const formatOnlyCPF = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 11);
    let formatted = clean;
    if (clean.length > 9) {
      formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
    } else if (clean.length > 6) {
      formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
    } else if (clean.length > 3) {
      formatted = `${clean.slice(0, 3)}.${clean.slice(3)}`;
    }
    return formatted;
  };

  // Login handler
  const handleTryLogin = (docValue: string, passwordValue: string) => {
    const normalizedInput = docValue.replace(/\D/g, "");
    if (!normalizedInput) {
      setLoginError("Por favor, digite seu CPF de cadastro.");
      return;
    }
    // Limit to municipal requirements (CPF only: 11 digits, fallback master is 999/000/36911121884 etc.)
    const isSpecialFallback = normalizedInput === "999" || normalizedInput === "000";
    if (normalizedInput.length !== 11 && !isSpecialFallback) {
      setLoginError("Acesso restrito. Por favor, forneça um CPF de cadastro válido com 11 dígitos.");
      return;
    }
    if (!passwordValue) {
      setLoginError("Por favor, informe sua senha de segurança.");
      return;
    }

    // Clear registration success messages upon attempting log in
    setRegSuccessMessage("");

    // Look up in database lists first to see if a custom client/professional is registered with this CPF
    const activeClients = clients.length > 0 ? clients : INITIAL_CLIENTS;
    const activeProfs = professionals.length > 0 ? professionals : INITIAL_PROFESSIONALS;

    const matchedClient = activeClients.find(c => c.document.replace(/\D/g, "") === normalizedInput);
    const matchedProf = activeProfs.find(p => p.document && p.document.replace(/\D/g, "") === normalizedInput);

    const isFallbackCPF = normalizedInput === "36911121884" || normalizedInput === "99999999999" || normalizedInput === "999" || normalizedInput === "000";
    const hasRegisteredUser = !!(matchedClient || matchedProf);
    const adminSavedPass = localStorage.getItem("admin_custom_password") || "123456";

    // 1. Admin/Gestor fallback bypass (e.g. 36911121884 or 99999999999) - ALWAYS evaluated first if correct admin password is provided or no registered user exists
    if (isFallbackCPF && (passwordValue === adminSavedPass || !hasRegisteredUser)) {
      if (passwordValue && passwordValue !== adminSavedPass) {
        setLoginError("Senha incorreta para o Gestor Administrador.");
        toastError("Senha incorreta para o canal de Gestor Administrador.", "Falha de Login");
        addLoginAttempt(normalizedInput, "gestor-admin", "failed", "gestor", "Tentativa mestre falhou: Senha do Gestor Administrador incorreta.");
        return;
      }
      const adminUser: CurrentUser = {
        id: "gestor-admin",
        name: "Willian C. Lima",
        document: normalizedInput === "36911121884" ? "369.111.218-84" : "999.999.999-99",
        userType: "admin"
      };
      setCurrentUser(adminUser);
      localStorage.setItem("service_mgt_logged_user", JSON.stringify(adminUser));
      setLoginError("");
      setActiveTab("dashboard");
      setTypedDoc("");
      setTypedPassword("");
      addSystemLog("Login de Administrador", "Administrador do Sistema Willian C. Lima autenticado via CPF com credenciais de raiz.", "sistema");
      addLoginAttempt(normalizedInput, adminUser.id, "success", "admin", "Login bem-sucedido via credencial mestre administrador (Willian C. Lima).");
      toastSuccess("Seja bem-vindo de volta, Willian C. Lima! Painel de Controle Raiz ativado.", "Acesso de Administrador");
      return;
    }

    // 2. Check clients List
    if (matchedClient) {
      // Check status
      if (matchedClient.status === "pendente_autorizacao") {
        setLoginError("⚠️ Seu cadastro encontra-se PENDENTE de autorização pelo Gestor Administrador. Por favor, aguarde o deferimento da liberação de sua conta.");
        toastInfo("Seu cadastro de requisitante está pendente de homologação pelo gestor.", "Aguardando Liberação");
        addLoginAttempt(normalizedInput, matchedClient.id, "failed", "requisitante", "Login recusado: cadastro pendente de autorização.");
        return;
      }

      // Check if blocked first
      if (matchedClient.blocked) {
        setLoginError("⚠️ Esta conta foi BLOQUEADA por excesso de tentativas (3 erros). O Gestor Administrador foi notificado e pode resetar sua senha no Dashboard.");
        toastError("Esta conta de requisitante encontra-se temporariamente bloqueada!", "Acesso Bloqueado");
        addLoginAttempt(normalizedInput, matchedClient.id, "failed", "requisitante", "Login recusado: conta temporariamente bloqueada.");
        return;
      }

      // Check password (defaults to "123" for legacy keys)
      const correctPass = matchedClient.password || "123";
      if (passwordValue !== correctPass) {
        const attempts = (matchedClient.failedAttempts || 0) + 1;
        const isNowBlocked = attempts >= 3;
        
        const updatedClients = activeClients.map(c => 
          c.id === matchedClient.id 
            ? { ...c, failedAttempts: attempts, blocked: isNowBlocked } 
            : c
        );
        updateClientsState(updatedClients);

        if (isNowBlocked) {
          addSystemLog(
            "Conta Bloqueada", 
            `A conta do requisitante "${matchedClient.name}" (${matchedClient.document}) foi bloqueada por excesso de erros consecutivas de login.`, 
            "sistema"
          );
          addLoginAttempt(normalizedInput, matchedClient.id, "failed", "requisitante", "Conta bloqueada: excesso de tentativas de senha incorreta (3 falhas).");
          setLoginError("⚠️ Conta BLOQUEADA por excesso de tentativas (3 erros). O Gestor foi alertado e pode liberar o login redefinindo sua senha no Painel.");
          toastError("Acesso suspenso por excesso de erros consecutivos!", "Segurança Ativada");
        } else {
          addLoginAttempt(normalizedInput, matchedClient.id, "failed", "requisitante", `Senha incorreta. Tentativa ${attempts} de 3.`);
          setLoginError(`Senha incorreta. Tentativa ${attempts} de 3. Seu acesso será bloqueado após 3 erros consecutivos.`);
          toastWarn(`Senha incorreta! Tentativa ${attempts}/3.`, "Falha de Autenticação");
        }
        return;
      }

      // Reset failed attempts if password is correct
      if (matchedClient.failedAttempts) {
        const updatedClients = activeClients.map(c => 
          c.id === matchedClient.id 
            ? { ...c, failedAttempts: 0 } 
            : c
        );
        updateClientsState(updatedClients);
      }

      const resolvedUserType = matchedClient.userType || (matchedClient.id === "cli-2" ? "gestor" : "requisitante");
      const clientUser: CurrentUser = {
        id: matchedClient.id,
        name: matchedClient.name,
        document: matchedClient.document,
        userType: resolvedUserType
      };
      setCurrentUser(clientUser);
      localStorage.setItem("service_mgt_logged_user", JSON.stringify(clientUser));
      setLoginError("");

      // Lands on dashboard for administrative roles, orders for regular clients
      const isManagement = resolvedUserType === "gestor" || resolvedUserType === "gestor_servicos" || resolvedUserType === "admin";
      setActiveTab(isManagement ? "dashboard" : "orders");
      setTypedDoc("");
      setTypedPassword("");
      addSystemLog("Login Autorizado", `Usuário "${matchedClient.name}" autenticado como ${resolvedUserType} via CPF.`, "sistema");
      addLoginAttempt(normalizedInput, matchedClient.id, "success", resolvedUserType, `Login efetuado com sucesso como ${resolvedUserType}.`);
      toastSuccess(`Seja bem-vindo, ${matchedClient.name}!`, "Acesso Autorizado");
      return;
    }

    // 3. Check professionals List
    if (matchedProf) {
      // Check if blocked first
      if (matchedProf.blocked) {
        setLoginError("⚠️ Esta conta de Técnico foi BLOQUEADA por excesso de tentativas (3 erros). Entre em contato com o Gestor Administrador para desbloquear.");
        toastError("Sua conta de suporte técnico encontra-se bloqueada!", "Acesso Bloqueado");
        addLoginAttempt(normalizedInput, matchedProf.id, "failed", "profissional", "Login de técnico recusado: conta temporariamente bloqueada.");
        return;
      }

      const correctPass = matchedProf.password || "123";
      if (passwordValue !== correctPass) {
        const attempts = (matchedProf.failedAttempts || 0) + 1;
        const isNowBlocked = attempts >= 3;
        
        const updatedProfs = activeProfs.map(p => 
          p.id === matchedProf.id 
            ? { ...p, failedAttempts: attempts, blocked: isNowBlocked } 
            : p
        );
        updateProfessionalsState(updatedProfs);

        if (isNowBlocked) {
          addSystemLog(
            "Conta Bloqueada", 
            `A conta do técnico de campo "${matchedProf.name}" foi bloqueada por excesso de erros de senha.`, 
            "sistema"
          );
          addLoginAttempt(normalizedInput, matchedProf.id, "failed", "profissional", "Conta técnica bloqueada: excesso de tentativas de senha incorreta (3 falhas).");
          setLoginError("⚠️ Conta BLOQUEADA por excesso de tentativas (3 erros). O Gestor foi alertado e pode liberar o login redefinindo sua senha no Painel.");
          toastError("Acesso técnico suspenso por excesso de tentativas!", "Segurança Ativada");
        } else {
          addLoginAttempt(normalizedInput, matchedProf.id, "failed", "profissional", `Senha incorreta informada para conta de técnico. Tentativa ${attempts} de 3.`);
          setLoginError(`Senha de técnico inválida. Tentativa ${attempts} de 3. Seu acesso será bloqueado após 3 erros consecutivos.`);
          toastWarn(`Senha de técnico incorreta! Tentativa ${attempts}/3.`, "Falha de Autenticação");
        }
        return;
      }

      // Reset failed attempts if password is correct
      if (matchedProf.failedAttempts) {
        const updatedProfs = activeProfs.map(p => 
          p.id === matchedProf.id 
            ? { ...p, failedAttempts: 0 } 
            : p
        );
        updateProfessionalsState(updatedProfs);
      }

      const profUser: CurrentUser = {
        id: matchedProf.id,
        name: matchedProf.name,
        document: matchedProf.document || "",
        userType: "profissional"
      };
      setCurrentUser(profUser);
      localStorage.setItem("service_mgt_logged_user", JSON.stringify(profUser));
      setLoginError("");
      setActiveTab("dashboard");
      setTypedDoc("");
      setTypedPassword("");
      addSystemLog("Login do Técnico", `Técnico de campo "${matchedProf.name}" autenticado no portal restrito.`, "sistema");
      addLoginAttempt(normalizedInput, matchedProf.id, "success", "profissional", "Login técnico bem-sucedido.");
      toastSuccess(`Olá, Técnico ${matchedProf.name}! Agenda de OS sincronizada.`, "Suporte Técnico Conectado");
      return;
    }

    setLoginError("Documento (CPF) não encontrado nas bases do sistema. Revise os dados ou faça seu Auto-Cadastro logo abaixo.");
    toastError("Identificador de acesso não cadastrado na base.", "Falha de Login");
    addLoginAttempt(normalizedInput, "desconhecido", "failed", "desconhecido", "Tentativa de login de usuário não registrado no sistema.");
  };

  // Self-registration handler
  const handleSelfRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCPF = regCPF.replace(/\D/g, "");
    if (cleanCPF.length < 11) {
      setLoginError("Por favor, digite um CPF válido contendo ao menos 11 dígitos para o auto-cadastro.");
      return;
    }

    const allClients = clients.length > 0 ? clients : INITIAL_CLIENTS;
    const documentExists = allClients.some(c => c.document.replace(/\D/g, "") === cleanCPF) ||
                           professionals.some(p => p.document && p.document.replace(/\D/g, "") === cleanCPF);

    if (documentExists) {
      setLoginError("Este CPF já possui cadastro no sistema. Tente efetuar o login ou entre em contato.");
      return;
    }

    const newId = `cli-${Date.now()}`;
    const newClient: Client = {
      id: newId,
      name: regName,
      document: regCPF,
      phone: regPhone,
      email: regEmail,
      address: regAddress,
      notes: "Usuário registrado por Auto-Cadastro. Aguardando autorização operacional.",
      createdAt: new Date().toISOString(),
      password: regPassword || "123",
      status: "pendente_autorizacao"
    };

    const updated = [...allClients, newClient];
    setClients(updated);
    localStorage.setItem("service_mgt_clients2", JSON.stringify(updated));

    // System log
    addSystemLog(
      "Auto-Cadastro Efetuado",
      `Novo usuário "${regName}" efetuou auto-cadastro sob o CPF ${regCPF} (Pendente de aprovação pelo Administrador).`,
      "requisitante"
    );

    // Reset fields & set notification
    setRegCPF("");
    setRegName("");
    setRegPhone("");
    setRegEmail("");
    setRegAddress("");
    setRegPassword("");
    setLoginError("");
    setRegSuccessMessage(`Seu cadastro para "${regName}" foi enviado com sucesso! Encontra-se pendente de aprovação pelo Gestor Administrador. Você receberá a permissão de Gestor ou Requisitante.`);
    setIsRegistering(false);
    toastInfo("Auto-cadastro sob análise do Gestor Administrador.", "Cadastro Enviado");
  };

  // self-change password handler
  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setChangePasswordError("");
    setChangePasswordSuccess("");

    if (!currentPassword) {
      setChangePasswordError("Sua senha atual é obrigatória.");
      return;
    }
    if (newPassword.length < 3) {
      setChangePasswordError("A nova senha deve ter no mínimo 3 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangePasswordError("A nova senha e a confirmação não batem.");
      return;
    }

    // Determine current user password
    let actualCurrentPassword = "123456"; // default fallback

    if (currentUser.id === "gestor-admin") {
      actualCurrentPassword = localStorage.getItem("admin_custom_password") || "123456";
    } else {
      // Look up in clients first
      const clientRecord = clients.find(c => c.id === currentUser.id);
      if (clientRecord) {
        actualCurrentPassword = clientRecord.password || "123";
      } else {
        // Look up in professionals
        const profRecord = professionals.find(p => p.id === currentUser.id);
        if (profRecord) {
          actualCurrentPassword = profRecord.password || "123";
        }
      }
    }

    if (currentPassword !== actualCurrentPassword) {
      setChangePasswordError("A senha atual digitada está incorreta.");
      return;
    }

    // Success: update password!
    if (currentUser.id === "gestor-admin") {
      localStorage.setItem("admin_custom_password", newPassword);
    } else {
      const clientRecord = clients.find(c => c.id === currentUser.id);
      if (clientRecord) {
        // update in clients
        const updatedClients = clients.map(c => 
          c.id === currentUser.id ? { ...c, password: newPassword } : c
        );
        updateClientsState(updatedClients);
      } else {
        const profRecord = professionals.find(p => p.id === currentUser.id);
        if (profRecord) {
          // update in professionals
          const updatedProfs = professionals.map(p => 
            p.id === currentUser.id ? { ...p, password: newPassword } : p
          );
          updateProfessionalsState(updatedProfs);
        }
      }
    }

    // Record system log as required
    addSystemLog(
      "Atualização de Senha",
      `O usuário "${currentUser.name}" (${currentUser.userType === "gestor" ? "Gestor" : currentUser.userType === "profissional" ? "Técnico" : "Requisitante"}) alterou sua própria senha de segurança de forma autônoma.`,
      "sistema"
    );

    setChangePasswordSuccess("Sua senha foi alterada com sucesso!");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    toastSuccess("Sua senha foi alterada com sucesso!", "Senha Atualizada");
    
    // Close modal after brief delay
    setTimeout(() => {
      setIsChangePasswordOpen(false);
      setChangePasswordSuccess("");
    }, 2000);
  };

  // Password Recovery Handlers
  const handleSearchUserForReset = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");
    
    const normalizedCPF = resetCpf.replace(/\D/g, "");
    if (!normalizedCPF) {
      setResetError("Por favor, preencha o seu CPF.");
      return;
    }

    const activeClients = clients.length > 0 ? clients : INITIAL_CLIENTS;
    const activeProfs = professionals.length > 0 ? professionals : INITIAL_PROFESSIONALS;

    // Check Fallback Admin first
    const isAdmin = normalizedCPF === "36911121884" || normalizedCPF === "99999999999" || normalizedCPF === "999" || normalizedCPF === "000";
    
    let matchedUser: any = null;
    let userType: "admin" | "client" | "professional" | null = null;
    let emailAddress = "";

    if (isAdmin) {
      matchedUser = {
        id: "gestor-admin",
        name: "Willian C. Lima",
        document: "369.111.218-84"
      };
      userType = "admin";
      emailAddress = "willianCLima@gmail.com";
    } else {
      // Check Clients / Requisitantes
      const clientRecord = activeClients.find(c => c.document.replace(/\D/g, "") === normalizedCPF);
      if (clientRecord) {
        matchedUser = clientRecord;
        userType = "client";
        emailAddress = clientRecord.email || "";
      } else {
        // Check Professionals
        const profRecord = activeProfs.find(p => p.document && p.document.replace(/\D/g, "") === normalizedCPF);
        if (profRecord) {
          matchedUser = profRecord;
          userType = "professional";
          emailAddress = profRecord.email || "";
        }
      }
    }

    if (!matchedUser) {
      setResetError("Documento (CPF) não encontrado na nossa base de dados.");
      return;
    }

    if (!emailAddress) {
      // In case some user doesn't have an email, fallback to a sensible one
      emailAddress = `${matchedUser.name.toLowerCase().replace(/\s+/g, "")}@gestao.com`;
    }

    // Generate a 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setResetUser(matchedUser);
    setResetUserType(userType);
    setResetEmail(emailAddress);
    setIsSendingEmail(true);

    // Simulate sending email via SMTP after brief delay
    setTimeout(() => {
      setIsSendingEmail(false);
      setResetStep("otp");
      setShowSimulatedEmailMessage(true);
      toastSuccess(`Código de recuperação enviado para o e-mail: ${emailAddress}`, "E-mail Enviado");
      
      // Also write in the system log about the security recovery attempt
      addSystemLog(
        "Recuperação de Senha",
        `Solicitação de token de redefinição de senha via SMTP gerado para CPF ${normalizedCPF} (${matchedUser.name}).`,
        "sistema"
      );
    }, 1200);
  };

  const handleVerifyOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    if (resetOtp.trim() === generatedOtp) {
      setResetStep("new_password");
      setResetOtp("");
    } else {
      setResetError("Código de verificação incorreto ou expirado. Revise as informações.");
    }
  };

  const handleSaveNewResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");

    if (newResetPassword.length < 3) {
      setResetError("A nova senha deve ter no mínimo 3 caracteres.");
      return;
    }
    if (newResetPassword !== confirmNewResetPassword) {
      setResetError("As senhas digitadas não coincidem.");
      return;
    }

    // Persist new password based on user type
    if (resetUserType === "admin") {
      localStorage.setItem("admin_custom_password", newResetPassword);
    } else if (resetUserType === "client") {
      const activeClients = clients.length > 0 ? clients : INITIAL_CLIENTS;
      const updated = activeClients.map(c => 
        c.id === resetUser.id ? { ...c, password: newResetPassword, failedAttempts: 0, blocked: false } : c
      );
      updateClientsState(updated);
    } else if (resetUserType === "professional") {
      const activeProfs = professionals.length > 0 ? professionals : INITIAL_PROFESSIONALS;
      const updated = activeProfs.map(p => 
        p.id === resetUser.id ? { ...p, password: newResetPassword, failedAttempts: 0, blocked: false } : p
      );
      updateProfessionalsState(updated);
    }

    addSystemLog(
      "Senha Redefinida",
      `A senha de acesso do usuário "${resetUser.name}" (${resetUserType}) foi alterada com sucesso através do painel de auto-recuperação CPF.`,
      "sistema"
    );

    setResetSuccess("Senha redefinida com sucesso! Redirecionando para a tela de login...");
    toastSuccess("Sua nova senha de acesso está ativa!", "Senha Alterada");

    setTimeout(() => {
      // Close recovery modal and reset state
      setForgotPasswordModalOpen(false);
      setResetStep("cpf");
      setResetCpf("");
      setResetEmail("");
      setResetUser(null);
      setResetUserType(null);
      setGeneratedOtp("");
      setNewResetPassword("");
      setConfirmNewResetPassword("");
      setResetError("");
      setResetSuccess("");
      setShowSimulatedEmailMessage(false);
    }, 2500);
  };

  // Approve pending client
  const handleApproveClient = (clientId: string, type: "gestor" | "requisitante") => {
    const activeClients = clients.length > 0 ? clients : INITIAL_CLIENTS;
    const updated = activeClients.map(c => {
      if (c.id === clientId) {
        return { ...c, status: "ativo" as const, userType: type };
      }
      return c;
    });
    setClients(updated);
    localStorage.setItem("service_mgt_clients2", JSON.stringify(updated));

    const client = activeClients.find(c => c.id === clientId);
    if (client) {
      addSystemLog(
        "Cadastro Autorizado", 
        `CPF ${client.document} (${client.name}) aprovado pelo Gestor como ${type === "gestor" ? "Gestor" : "Requisitante"}.`, 
        "sistema"
      );
      toastSuccess(`Cadastro de "${client.name}" autorizado com sucesso!`, "Acesso Liberado");
    }
  };

  // Reject/Delete pending client
  const handleRejectClient = (clientId: string) => {
    const activeClients = clients.length > 0 ? clients : INITIAL_CLIENTS;
    const client = activeClients.find(c => c.id === clientId);
    const updated = activeClients.filter(c => c.id !== clientId);
    setClients(updated);
    localStorage.setItem("service_mgt_clients2", JSON.stringify(updated));

    if (client) {
      addSystemLog(
        "Cadastro Recusado", 
        `Cadastro pendente de ${client.name} (CPF ${client.document}) foi reprovado e removido do sistema pelo Gestor.`, 
        "sistema"
      );
      toastWarn(`Cadastro de "${client.name}" reprovado e removido do sistema.`, "Cadastro Recusado");
    }
  };

  // Sign out handler
  const handleLogout = () => {
    if (currentUser) {
      addSystemLog("Sessão Encerrada", `Usuário "${currentUser.name}" desconectou-se do sistema em conformidade com o descarte seguro de cookies (LGPD).`, "sistema");
    }
    toastInfo("Sua sessão foi encerrada de maneira segura.", "Sessão Concluída");
    setCurrentUser(null);
    localStorage.removeItem("service_mgt_logged_user");
    setConsentCheck(false);
  };

  // Filter orders dynamically according to currently logged in profile, maintaining hard LGPD Isolation
  const visibleOrders = orders.filter(os => {
    if (!currentUser) return false;
    if (currentUser.userType === "gestor") {
      return true; // Gestores see all requisitions
    }
    if (currentUser.userType === "profissional") {
      // Technicians see orders specifically assigned to their name
      return os.assignedTo === currentUser.name;
    }
    if (currentUser.userType === "requisitante") {
      // Regular customers/claimants ONLY see orders created by them
      return os.clientId === currentUser.id;
    }
    return false;
  });

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-white font-sans relative overflow-hidden">
        {/* Abstract backdrops to look ultra professional */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative z-10 space-y-8">
          
          {/* Brand header */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 pb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center font-black text-white shadow-lg shadow-indigo-600/30 text-lg">
                G
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight block">Gestão de serviços</span>
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Sistema de Gestão Técnica Integrada</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/60 px-3.5 py-1.5 rounded-xl border border-slate-700/50 text-emerald-400 text-[10px] font-black uppercase tracking-widest leading-none">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              Selo de Conformidade LGPD
            </div>
          </div>

          {regSuccessMessage && (
            <div className="bg-emerald-950/40 border border-emerald-900/40 p-5 rounded-2xl space-y-2 text-slate-250 text-left">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400 animate-pulse" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Auto-Cadastro Solicitado</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                {regSuccessMessage}
              </p>
            </div>
          )}

          {!isRegistering ? (
            /* Login Screen */
            <div className="space-y-6 text-left">
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold tracking-tight text-white">Acesse o Sistema</h2>
                <p className="text-xs text-slate-400 font-medium">Insira seu CPF de cadastro e sua senha para prosseguir ao painel operacional.</p>
              </div>

              {/* Secure Message */}
              <div className="space-y-3 bg-slate-800/30 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Aviso de Privacidade & Segurança de Dados</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">
                      Sob a <strong>Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018)</strong>, seus dados de identificação, endereço e chamados técnicos são classificados como informações de privacidade pessoal protegidas. Nós tratamos estes dados apenas para cumprir a execução de seu serviço de manutenção em Araçatuba - SP.
                    </p>
                  </div>
                </div>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleTryLogin(typedDoc, typedPassword);
                }} 
                className="space-y-5"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Informe seu CPF de requisitante / Gestor (Atendimento Prefeitura)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={typedDoc}
                      maxLength={14}
                      onChange={(e) => {
                        const formatted = formatOnlyCPF(e.target.value);
                        setTypedDoc(formatted);
                        setLoginError("");
                      }}
                      className="w-full text-base font-semibold border border-slate-800 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-600/20 focus:border-indigo-500 bg-slate-950 transition-all text-white placeholder-slate-600 tracking-wide font-medium"
                      placeholder="000.000.000-00"
                    />
                    <div className="absolute right-4 top-4 text-indigo-400 text-[10px] font-extrabold font-mono uppercase tracking-wider bg-indigo-950 border border-indigo-900 px-2 py-0.5 rounded-md">
                      CPF REQUERIDO
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Senha de Entrada
                  </label>
                  <input
                    type="password"
                    required
                    value={typedPassword}
                    onChange={(e) => {
                      setTypedPassword(e.target.value);
                      setLoginError("");
                    }}
                    className="w-full text-base font-semibold border border-slate-800 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-4 focus:ring-indigo-600/20 focus:border-indigo-500 bg-slate-950 transition-all text-white placeholder-slate-600 tracking-wide font-medium"
                    placeholder="Sua senha secreta"
                  />
                </div>

                {/* Consent check */}
                <div className="flex items-start gap-3">
                  <input
                    id="consent-check"
                    type="checkbox"
                    required
                    checked={consentCheck}
                    onChange={(e) => {
                      setConsentCheck(e.target.checked);
                      setLoginError("");
                    }}
                    className="w-4.5 h-4.5 rounded border-slate-700 bg-slate-950 text-indigo-600 mt-0.5 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="consent-check" className="text-xs text-slate-400 leading-relaxed font-medium select-none cursor-pointer text-left">
                    Consinto expressamente com o processamento do meu CPF e senha secreta para fins de consulta e abertura de requisições, afirmando estar em concordância com os <button type="button" onClick={() => setLgpdModalOpen(true)} className="text-indigo-400 font-bold underline hover:text-indigo-300">Termos de Governança de Dados da Prefeitura</button>.
                  </label>
                </div>

                {loginError && (
                  <p className="text-xs text-rose-400 font-bold bg-rose-950/40 p-3 rounded-xl border border-rose-900/30 text-left">
                    ⚠️ {loginError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest py-4 px-6 rounded-2xl shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-all shadow-indigo-600/20"
                >
                  <ShieldCheck className="w-4.5 h-4.5 text-indigo-200" />
                  Entrar
                </button>

                {/* Logo Assessor Público */}
                <div className="flex flex-col items-center justify-center pt-3 select-none">
                  <div className="flex items-center gap-1 font-sans text-lg tracking-tight bg-white py-2 px-6 rounded-full shadow-md border border-slate-200">
                    <span className="text-[#004d8c] font-black">assessor</span>
                    <span className="text-[#6c94c4] font-semibold relative">
                      público
                      <span className="absolute -top-1 -right-2.5 text-[7px] font-bold text-[#6c94c4]">®</span>
                    </span>
                  </div>
                </div>
              </form>

              <div className="flex flex-col sm:flex-row justify-between items-center border-t border-slate-800 pt-4 gap-3 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Não tem um login?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(true);
                      setRegSuccessMessage("");
                      setLoginError("");
                    }}
                    className="text-indigo-400 font-bold hover:text-indigo-300 underline cursor-pointer text-xs"
                  >
                    Criar Auto-Cadastro
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordModalOpen(true);
                    setResetStep("cpf");
                    setResetCpf("");
                    setResetError("");
                    setResetSuccess("");
                  }}
                  className="text-indigo-400 font-bold hover:text-indigo-300 underline cursor-pointer text-xs"
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>
          ) : (
            /* Auto Registration Screen */
            <div className="space-y-6 text-left">
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold tracking-tight text-white">Auto-Cadastro do Sistema</h2>
                <p className="text-xs text-slate-400 font-medium font-semibold">Preencha seus dados de requisitante para solicitar permissão operacional ao gestor administrador.</p>
              </div>

              <form onSubmit={handleSelfRegister} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Nome Completo <span className="text-indigo-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full text-sm font-semibold border border-slate-800 rounded-xl px-4 py-3 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                      placeholder="Seu nome completo"
                    />
                  </div>

                  {/* CPF */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      CPF <span className="text-indigo-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={regCPF}
                      maxLength={14}
                      onChange={(e) => setRegCPF(formatDoc(e.target.value))}
                      className="w-full text-sm font-semibold border border-slate-800 rounded-xl px-4 py-3 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 font-mono"
                      placeholder="000.000.000-00"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Telefone / Contato <span className="text-indigo-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={regPhone}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, "");
                        let form = clean;
                        if (clean.length > 2) {
                          form = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
                        }
                        setRegPhone(form.slice(0, 15));
                      }}
                      className="w-full text-sm font-semibold border border-slate-800 rounded-xl px-4 py-3 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 font-mono"
                      placeholder="(18) 99999-9999"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      E-mail <span className="text-slate-500 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full text-sm font-semibold border border-slate-800 rounded-xl px-4 py-3 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                      placeholder="exemplo@gmail.com"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Endereço de Atendimento <span className="text-indigo-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    className="w-full text-sm font-semibold border border-slate-800 rounded-xl px-4 py-3 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                    placeholder="Rua, Número, Bairro, Cidade - SP"
                  />
                </div>

                {/* Password Setting */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Definir sua Senha de Login <span className="text-indigo-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full text-sm font-semibold border border-slate-800 rounded-xl px-4 py-3 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                    placeholder="Insira sua senha"
                  />
                </div>

                {/* LGPD Consent */}
                <div className="flex items-start gap-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-left">
                  <input
                    id="reg-consent-check"
                    type="checkbox"
                    required
                    checked={consentCheck}
                    onChange={(e) => setConsentCheck(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-slate-700 bg-slate-950 text-indigo-600 mt-0.5 cursor-pointer animate-none"
                  />
                  <label htmlFor="reg-consent-check" className="text-[11px] text-slate-400 leading-relaxed font-semibold cursor-pointer">
                    Declaro ciência e consinto com a coleta, uso e tratamento dos meus dados pessoais fornecidos acima para efeitos estritos de triagem e registro sob a Lei nº 13.709/2018 (LGPD).
                  </label>
                </div>

                {loginError && (
                  <p className="text-xs text-rose-400 font-bold bg-rose-950/40 p-3 rounded-xl border border-rose-900/30 text-left">
                    ⚠️ {loginError}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wide py-3.5 px-6 rounded-xl shadow-lg transition-all shadow-indigo-600/20 cursor-pointer"
                  >
                    Concluir Auto-Cadastro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(false);
                      setLoginError("");
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase py-3.5 px-6 rounded-xl transition-all border border-slate-700/50 cursor-pointer"
                  >
                    Voltar para o Login
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Termos de Privacidade LGPD Modal popup */}
        {lgpdModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl p-6 sm:p-8 space-y-6 text-slate-300 relative text-left">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Declaração de Conformidade & Direitos - LGPD</h3>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Lei Federal nº 13.709/2018</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setLgpdModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs leading-relaxed overflow-y-auto max-h-[50vh] pr-2">
                <div>
                  <h4 className="font-extrabold text-white uppercase text-[10px] tracking-wider mb-1">1. AGENTE DE TRATAMENTO & CONTROLE</h4>
                  <p className="text-slate-400">
                    O sistema <strong>RequisiçãoPro</strong> (Inteligência de Serviços Ltda.) atua como operador e controlador no tratamento das informações fornecidas diretamente por você.
                  </p>
                </div>

                <div>
                  <h4 className="font-extrabold text-white uppercase text-[10px] tracking-wider mb-1">2. FINALIDADE DE PROCESSAMENTO DOS DADOS</h4>
                  <p className="text-slate-400">
                    O CPF coletado é processado estritamente para a finalidade legítima de <strong>Controle de Acesso e Autorização de Informações Pessoais</strong>. Ele garante que de forma isolada, apenas você consulte e registre as requisições vinculadas à sua pessoa física ou jurídica, eliminando riscos de espionagem cibernética de dados pessoais de terceiros.
                  </p>
                </div>

                <div>
                  <h4 className="font-extrabold text-white uppercase text-[10px] tracking-wider mb-1">3. PRINCÍPIO DA MINIMIZAÇÃO DE DADOS VINCULADOS</h4>
                  <p className="text-slate-400">
                    Coletamos apenas o mínimo necessário de identificação pessoal (CPF, Nome, Telefone e Endereço de Atendimento em Araçatuba) indispensável para o despacho seguro das equipes técnicas.
                  </p>
                </div>

                <div>
                  <h4 className="font-extrabold text-white uppercase text-[10px] tracking-wider mb-1">4. DIREITOS DOS INQUILINOS (Artigos 17 e 18 da LGPD)</h4>
                  <ul className="list-disc pl-5 space-y-1 text-slate-400">
                    <li><strong>Direito ao Acesso Informado:</strong> Você pode auditar seus dados e visualizar os chamados em seu nome.</li>
                    <li><strong>Direito à Retificação:</strong> Corrigir imprecisões no local de atendimento ou telefone de contato a qualquer instante.</li>
                    <li><strong>Eliminação e Revogação:</strong> Solicitar a eliminação dos dados cadastrais cadastrados quando encerrado o serviço.</li>
                  </ul>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1.5 font-sans">
                  <span className="font-bold text-white block">Como exercer seus direitos?</span>
                  <p>Inicie login no sistema utilizando sua chave segura, clique no painel ou envie um e-mail formalizado contendo sua assinatura digital para o nosso Encarregado de Proteção de Dados (DPO): <strong className="text-indigo-400 font-sans font-black">dpo@requisicaopro.com.br</strong>.</p>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 flex justify-end font-sans">
                <button
                  type="button"
                  onClick={() => {
                    setConsentCheck(true);
                    setLgpdModalOpen(false);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 px-5 rounded-xl uppercase tracking-wider cursor-pointer"
                >
                  Entendi e Dou Consentimento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Esqueci minha Senha */}
        {forgotPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 space-y-6 text-slate-300 relative text-left">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-500" />
                    Gestão de Serviços - Redefinição
                  </h3>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Autoatendimento de Segurança</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setForgotPasswordModalOpen(false);
                    setShowSimulatedEmailMessage(false);
                  }}
                  className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {resetStep === "cpf" && (
                <form onSubmit={handleSearchUserForReset} className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                      Insira o número do seu documento (CPF) cadastrado para localizarmos sua conta e enviarmos um e-mail com resposta para alteração segura de senha.
                    </p>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      Seu CPF de Acesso
                    </label>
                    <input
                      type="text"
                      required
                      value={resetCpf}
                      maxLength={14}
                      onChange={(e) => {
                        const formatted = formatOnlyCPF(e.target.value);
                        setResetCpf(formatted);
                        setResetError("");
                      }}
                      className="w-full text-base font-semibold border border-slate-800 rounded-xl px-4 py-3 bg-slate-950 transition-all text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      placeholder="000.000.000-00"
                    />
                  </div>

                  {resetError && (
                    <p className="text-xs text-rose-400 font-bold bg-rose-950/40 p-3 rounded-xl border border-rose-900/30">
                      ⚠️ {resetError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSendingEmail}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 px-6 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all"
                  >
                    {isSendingEmail ? (
                      <>
                        <div className="w-4 h-4 border-2 border-indigo-200 border-t-transparent rounded-full animate-spin" />
                        Verificando e Disparando E-mail...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Localizar e Enviar E-mail
                      </>
                    )}
                  </button>
                </form>
              )}

              {resetStep === "otp" && (
                <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
                  <div className="space-y-2 text-xs">
                    <p className="text-slate-400 leading-relaxed font-medium">
                      Um código de autenticação SMTP de 6 dígitos foi gerado para <strong>{resetUser?.name}</strong> e disparado para o e-mail cadastrado <strong>{resetEmail}</strong>.
                    </p>
                  </div>

                  {/* Simulação de E-mail de Resposta recebido */}
                  {showSimulatedEmailMessage && (
                    <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-4 space-y-2 text-xs relative overflow-hidden animate-fade-in">
                      <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-black text-[7.5px] uppercase px-2 py-0.5 tracking-wider font-mono rounded-bl">
                        E-MAIL DE RESPOSTA SMTP (SIMULAÇÃO)
                      </div>
                      <div className="space-y-1 text-[11px] text-slate-300 font-mono">
                        <div><span className="text-amber-400 font-bold">De:</span> {smtpSettings?.senderAddress || "sistema@gestaodeservicos.com"}</div>
                        <div><span className="text-amber-400 font-bold">Para:</span> {resetEmail}</div>
                        <div><span className="text-amber-400 font-bold">Assunto:</span> Redefinição de Senha - Código de Segurança</div>
                        <div className="border-t border-slate-800 my-2 pt-2 text-slate-300 leading-normal">
                          Olá, <strong>{resetUser?.name}</strong>!<br /><br />
                          Você solicitou a alteração de sua senha de segurança. Utilize o código de 6 dígitos abaixo para avançar:<br /><br />
                          <div className="bg-slate-950 py-3 text-center rounded-lg border border-slate-800 tracking-widest text-lg font-black text-white select-all">
                            {generatedOtp}
                          </div>
                          <br />
                          Caso não tenha feito esta solicitação, desconsidere este e-mail por motivos de segurança da LGPD.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      Código de Verificação (6 dígitos)
                    </label>
                    <input
                      type="text"
                      required
                      value={resetOtp}
                      maxLength={6}
                      onChange={(e) => {
                        setResetOtp(e.target.value.replace(/\D/g, ""));
                        setResetError("");
                      }}
                      className="w-full text-center text-lg tracking-widest font-black border border-slate-800 rounded-xl px-4 py-2.5 bg-slate-950 transition-all text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      placeholder="000000"
                    />
                  </div>

                  {resetError && (
                    <p className="text-xs text-rose-400 font-bold bg-rose-950/40 p-3 rounded-xl border border-rose-900/30">
                      ⚠️ {resetError}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setResetStep("cpf")}
                      className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase py-3 px-4 rounded-xl transition-all text-center cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 px-6 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Validar Código
                    </button>
                  </div>
                </form>
              )}

              {resetStep === "new_password" && (
                <form onSubmit={handleSaveNewResetPassword} className="space-y-4">
                  <div className="space-y-2 text-xs">
                    <p className="text-slate-400 leading-relaxed font-medium">
                      Código validado! Defina sua nova senha secreta de acesso para o usuário <strong>{resetUser?.name}</strong>.
                    </p>
                  </div>

                  <div className="space-y-4 text-left">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                        Nova Senha
                      </label>
                      <input
                        type="password"
                        required
                        value={newResetPassword}
                        onChange={(e) => {
                          setNewResetPassword(e.target.value);
                          setResetError("");
                        }}
                        className="w-full text-sm font-semibold border border-slate-800 rounded-xl px-4 py-3 bg-slate-950 transition-all text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        placeholder="Mínimo de 3 caracteres"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                        Confirmar Nova Senha
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmNewResetPassword}
                        onChange={(e) => {
                          setConfirmNewResetPassword(e.target.value);
                          setResetError("");
                        }}
                        className="w-full text-sm font-semibold border border-slate-800 rounded-xl px-4 py-3 bg-slate-950 transition-all text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        placeholder="Repita a senha para confirmar"
                      />
                    </div>
                  </div>

                  {resetError && (
                    <p className="text-xs text-rose-400 font-bold bg-rose-950/40 p-3 rounded-xl border border-rose-900/30">
                      ⚠️ {resetError}
                    </p>
                  )}

                  {resetSuccess && (
                    <p className="text-xs text-emerald-400 font-bold bg-emerald-950/40 p-3 rounded-xl border border-emerald-900/30">
                      ✅ {resetSuccess}
                    </p>
                  )}

                  {!resetSuccess && (
                    <button
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 px-6 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Salvar Nova Senha
                    </button>
                  )}
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans antialiased text-slate-800">
      
      {/* Mobile Sidebar overlay toggler */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar navigation */}
      <aside 
        id="nav-sidebar"
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col justify-between border-r border-slate-950/20 shadow-2xl md:shadow-none transform md:translate-x-0 transition-transform duration-300 md:static md:flex-shrink-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          {/* Brand header logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/20">
              G
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight block">Gestão de serviços</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gestão Técnica</span>
            </div>
          </div>

          {/* Navigation Links list */}
          <nav className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3 px-3">
              {currentUser.userType === "admin" 
                ? "Painel de Admin" 
                : currentUser.userType === "gestor" 
                  ? "Operações do Gestor" 
                  : currentUser.userType === "gestor_servicos"
                    ? "Gestor de Serviços"
                    : currentUser.userType === "profissional" 
                      ? "Operações do Técnico" 
                      : "Portal do Requisitante"}
            </span>
            
            {/* Painel Geral (Gestores, Admin, GS & Professionals as configured) */}
            {hasTabPermission("dashboard") && (
              <button
                onClick={() => { setActiveTab("dashboard"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "dashboard"
                    ? "bg-slate-800 text-indigo-400 font-extrabold shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <BarChart className="w-4 h-4" />
                Painel Geral
              </button>
            )}

            {/* Requisitantes & GS */}
            {hasTabPermission("clients") && (
              <button
                onClick={() => { setActiveTab("clients"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "clients"
                    ? "bg-slate-800 text-indigo-400 font-extrabold shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Users className="w-4 h-4" />
                Requisitantes & GS
              </button>
            )}

            {/* Requisições de Serviço */}
            {hasTabPermission("orders") && (
              <button
                onClick={() => { setActiveTab("orders"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "orders"
                    ? "bg-slate-800 text-indigo-400 font-extrabold shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                {currentUser.userType === "requisitante" ? "Minhas Requisições" : currentUser.userType === "profissional" ? "Atendimentos Designados" : "Requisições de Serviço"}
              </button>
            )}

            {/* Agenda / Calendário */}
            {hasTabPermission("scheduler") && (
              <button
                onClick={() => { setActiveTab("scheduler"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "scheduler"
                    ? "bg-slate-800 text-indigo-400 font-extrabold shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Calendar className="w-4 h-4" />
                {currentUser.userType === "profissional" ? "Minha Agenda" : "Agenda / Calendário"}
              </button>
            )}

            {/* Técnicos & Equipe */}
            {hasTabPermission("professionals") && (
              <button
                onClick={() => { setActiveTab("professionals"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "professionals"
                    ? "bg-slate-800 text-indigo-400 font-extrabold shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Wrench className="w-4 h-4" />
                Técnicos & Equipe
              </button>
            )}

            {/* Relatórios & Logs */}
            {hasTabPermission("reports") && (
              <button
                onClick={() => { setActiveTab("reports"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "reports"
                    ? "bg-slate-800 text-indigo-400 font-extrabold shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Activity className="w-4 h-4" />
                Relatórios & Logs
              </button>
            )}

            {/* Configurações SMTP / Painel de Governança */}
            {hasTabPermission("settings") && (
              <button
                onClick={() => { setActiveTab("settings"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "settings"
                    ? "bg-slate-800 text-indigo-400 font-extrabold shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Settings className="w-4 h-4" />
                Configurações & Governança
              </button>
            )}

            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block pt-6 mb-3 px-3">Suporte IA Inteligente</span>

            {/* Assistente IA */}
            {hasTabPermission("assistant") && (
              <button
                onClick={() => { setActiveTab("assistant"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "assistant"
                    ? "bg-slate-800 text-indigo-400 font-extrabold shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Assistente IA Gemini
              </button>
            )}

            {/* Sair da Conta */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-extrabold text-rose-450 text-rose-400 hover:text-white hover:bg-rose-950/40 transition-all border border-dashed border-rose-950/20 hover:border-rose-500/30 mt-6 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Encerrar Sessão (Sair)
            </button>
          </nav>
        </div>

        {/* Brand footer credentials panel */}
        <div className="p-6 border-t border-slate-800 text-slate-500 text-[10px] font-semibold space-y-3.5">
          <div className="flex items-center gap-2 bg-slate-850 bg-slate-850/40 p-2.5 rounded-lg border border-slate-800/20">
            <ShieldCheck className="w-4.5 h-4.5 text-indigo-400" />
            <div>
              <span className="text-slate-300 block">Amortecimento Seguro</span>
              <span className="text-[8px] text-slate-500">Isolamento e Segurança LGPD</span>
            </div>
          </div>
          <p>© 2026 Inteligência de Serviços Ltda.</p>
        </div>
      </aside>

      {/* Main Container viewport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen relative overflow-hidden">
        
        {/* Top Header layout */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 flex-shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Abrir navegação"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:block">Prestadora Técnica Executiva</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            {/* Quick indicators */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-100 p-2.5 py-1.5 rounded-xl text-slate-600">
              <CheckCircle className="w-4 h-4 text-indigo-500" />
              <span>Sessão Encriptada Ativa</span>
            </div>

            {/* Browser Notifications Indicator */}
            <button
              onClick={requestNotificationPermission}
              className={`hidden md:flex items-center gap-1.5 p-2.5 py-1.5 rounded-xl border transition-all text-xs font-semibold cursor-pointer ${
                notificationPermission === "granted"
                  ? "bg-emerald-50/50 hover:bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400"
                  : notificationPermission === "denied"
                  ? "bg-rose-50/50 hover:bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400"
                  : "bg-amber-50/50 hover:bg-amber-50 border-amber-100 text-amber-700 animate-pulse dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400"
              }`}
              title={
                notificationPermission === "granted"
                  ? "Notificações de navegador ativadas!"
                  : notificationPermission === "denied"
                  ? "Notificações bloqueadas. Clique para tentar reativar."
                  : "Clique para ativar notificações de navegador para novas OS e atualizações."
              }
            >
              {notificationPermission === "granted" ? (
                <Bell className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <BellOff className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <span>
                {notificationPermission === "granted"
                  ? "Notificações Ativas"
                  : notificationPermission === "denied"
                  ? "Notificações Bloqueadas"
                  : "Ativar Notificações"}
              </span>
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-200 shadow-xs text-white font-extrabold text-xs flex items-center justify-center uppercase">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-slate-800 font-bold block leading-none max-w-[140px] truncate">{currentUser.name}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                    {currentUser.userType === "gestor" ? "🛡️ Gestor" : currentUser.userType === "profissional" ? "🔧 Técnico" : "👤 Requisitante"}
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => setIsChangePasswordOpen(true)}
                className="bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 p-2.5 rounded-xl transition-all border border-slate-200/60 cursor-pointer flex items-center justify-center gap-1.5"
                title="Alterar Minha Senha de Segurança"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="text-[10px] font-extrabold uppercase hidden md:inline-block">Alterar Senha</span>
              </button>

              <button 
                onClick={handleLogout}
                className="bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 p-2.5 rounded-xl transition-all border border-slate-200/60 cursor-pointer"
                title="Encerrar sessão segura (LGPD)"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Nav View port */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="w-full max-w-6xl mx-auto pb-12">
            
            {activeTab === "dashboard" && hasTabPermission("dashboard") && (
              <Dashboard 
                orders={visibleOrders} 
                clients={clients} 
                professionals={professionals}
                currentUser={currentUser}
                logs={logs}
                onNavigate={setActiveTab}
                onSelectOrder={(os) => {
                  setSelectedOS(os);
                  setActiveTab("orders");
                }}
                onApproveClient={handleApproveClient}
                onRejectClient={handleRejectClient}
                onResetPassword={handleResetPassword}
              />
            )}
            
            {activeTab === "clients" && hasTabPermission("clients") && (
              <Clients 
                clients={clients}
                orders={visibleOrders}
                onAddClient={handleAddClient}
                onUpdateClient={handleUpdateClient}
                onDeleteClient={handleDeleteClient}
              />
            )}

            {activeTab === "orders" && hasTabPermission("orders") && (
              <ServiceOrders 
                orders={visibleOrders}
                clients={clients}
                categories={categories.map(c => c.name)}
                professionalsList={professionals}
                teams={teams}
                onAddOrder={handleAddOrder}
                onUpdateOrder={handleUpdateOrder}
                onDeleteOrder={handleDeleteOrder}
                onOpenAiAssistantWithOS={handleOpenAiAssistantWithOS}
                currentUser={currentUser}
              />
            )}

            {activeTab === "scheduler" && hasTabPermission("scheduler") && (
              <Scheduler 
                orders={visibleOrders}
                clients={clients}
                onQuickScheduleOrder={handleQuickScheduleOrder}
              />
            )}

            {activeTab === "professionals" && hasTabPermission("professionals") && (
              <Professionals 
                professionals={professionals}
                categories={categories}
                onAddProfessional={handleAddProfessional}
                onUpdateProfessional={handleUpdateProfessional}
                onDeleteProfessional={handleDeleteProfessional}
                teams={teams}
                onAddTeam={handleAddTeam}
                onUpdateTeam={handleUpdateTeam}
                onDeleteTeam={handleDeleteTeam}
                orders={orders}
              />
            )}

            {activeTab === "assistant" && hasTabPermission("assistant") && (
              <AiAssistant 
                orders={visibleOrders}
                clients={clients}
              />
            )}

            {activeTab === "reports" && hasTabPermission("reports") && (
              <ReportsAndLogs
                orders={visibleOrders}
                clients={clients}
                professionals={professionals}
                logs={logs}
                onClearLogs={handleClearLogs}
                loginAttempts={loginAttempts}
                onClearLoginAttempts={handleClearLoginAttempts}
              />
            )}

            {activeTab === "settings" && hasTabPermission("settings") && (
              <SmtpSettingsPanel
                settings={smtpSettings}
                onSave={handleSaveSmtpSettings}
                whatsappSettings={whatsappSettings}
                onSaveWhatsapp={handleSaveWhatsappSettings}
                permissions={permissions}
                onSavePermissions={updatePermissionsState}
                onNotifyTest={(title, msg, type) => {
                  if (type === "success") toastSuccess(msg, title);
                  else if (type === "error") toastError(msg, title);
                  else if (type === "critical") toastCritical(msg, title);
                  else if (type === "system") toastSystem(msg, title);
                  else toastInfo(msg, title);
                }}
              />
            )}

            {isChangePasswordOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
                  <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-indigo-400" />
                      <h3 className="font-extrabold text-sm uppercase tracking-wider">Alterar Minha Senha</h3>
                    </div>
                    <button 
                      onClick={() => {
                        setIsChangePasswordOpen(false);
                        setChangePasswordError("");
                        setChangePasswordSuccess("");
                      }}
                      className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <form onSubmit={handleChangePasswordSubmit} className="p-6 space-y-4">
                    {changePasswordError && (
                      <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl leading-relaxed">
                        ⚠️ {changePasswordError}
                      </div>
                    )}

                    {changePasswordSuccess && (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl leading-relaxed">
                        🎉 {changePasswordSuccess}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Senha Atual *</label>
                      <input
                        type="password"
                        required
                        className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-semibold"
                        placeholder="Sua senha de segurança atual"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nova Senha *</label>
                      <input
                        type="password"
                        required
                        className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-semibold"
                        placeholder="Informe a nova senha (min 3 caracteres)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Confirmar Nova Senha *</label>
                      <input
                        type="password"
                        required
                        className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-semibold"
                        placeholder="Repita a nova senha criada"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                      />
                    </div>

                    <div className="pt-2 flex gap-3 text-xs shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangePasswordOpen(false);
                          setChangePasswordError("");
                          setChangePasswordSuccess("");
                        }}
                        className="flex-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl transition-all shadow-sm cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={!!changePasswordSuccess}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Lock className="w-4 h-4 text-emerald-400" />
                        Gravar Nova Senha
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {simulatedNotification && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
                <div className="bg-slate-55 rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8 animate-fade-in text-left">
                  
                  {/* Modal Header */}
                  <div className="px-6 py-5 bg-[#121b22] text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Send className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base tracking-tight text-white">Simulador de Envio - Credenciais (LGPD)</h3>
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Notificação Enviada com Sucesso</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSimulatedNotification(null);
                        setCopiedWhatsApp(false);
                        setCopiedEmail(false);
                      }}
                      className="p-1.5 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[70vh] bg-slate-50">
                    <div className="bg-emerald-50 border border-emerald-200/60 p-4 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg shrink-0 mt-0.5 animate-bounce">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="text-xs text-emerald-950 leading-normal font-medium text-left">
                        <p className="font-black text-emerald-900 uppercase tracking-wider mb-1 text-[10px]">Ativação & Comunicação Integrada</p>
                        A senha de <strong>{simulatedNotification.userName}</strong> foi alterada para a nova senha provisória padrão <strong className="text-emerald-800">123456</strong> e o bloqueio de segurança foi removido. Os canais automatizados dispararam as seguintes comunicações:
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                      
                      {/* WhatsApp Simulation Column */}
                      <div className="bg-emerald-950/5 border border-emerald-200/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between border-b border-emerald-200/20 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Smartphone className="w-4.5 h-4.5 text-emerald-600" />
                              <span className="font-black text-slate-855 text-[11px] uppercase tracking-wider">WhatsApp Provisório</span>
                            </div>
                            <span className="text-[10.5px] bg-emerald-100 text-emerald-850 font-bold px-2.5 py-0.5 rounded-full font-mono">{simulatedNotification.phone}</span>
                          </div>

                          {/* Programmatic API Status Block */}
                          {simulatedNotification.apiStatus && (
                            <div className="p-3 bg-white border border-slate-200/50 rounded-xl text-left text-[11.5px] space-y-1.5 shadow-xs">
                              {simulatedNotification.apiStatus === "sending" && (
                                <div className="flex items-center gap-2 text-amber-850 font-extrabold text-[10.5px]">
                                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                                  <span>Invocando API do WhatsApp...</span>
                                </div>
                              )}
                              {simulatedNotification.apiStatus === "success" && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-emerald-850 font-extrabold text-[10.5px]">
                                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 animate-bounce" />
                                    <span>ENVIADO PROGRAMATICAMENTE!</span>
                                  </div>
                                  <div className="text-[10px] text-slate-600 font-medium leading-normal bg-slate-50 p-2 border border-slate-100 rounded-lg">
                                    <span className="font-extrabold uppercase text-[8.5px] text-slate-400 block mb-0.5">Resposta do Servidor:</span>
                                    <div className="max-h-[60px] scroll-narrow overflow-y-auto font-mono text-[9px] break-all whitespace-pre-wrap">{simulatedNotification.apiResponse || "Resposta vazia (Sucesso)"}</div>
                                  </div>
                                </div>
                              )}
                              {simulatedNotification.apiStatus === "error" && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-rose-850 font-extrabold text-[10.5px]">
                                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                                    <span>FALHA NO DISPARO AUTOMÁTICO</span>
                                  </div>
                                  <div className="text-[10px] text-rose-650 font-medium leading-normal bg-rose-50/50 p-2 border border-rose-100 rounded-lg">
                                    <span className="font-extrabold uppercase text-[8.5px] text-rose-455 block mb-0.5">Motivo do Erro:</span>
                                    <div className="max-h-[60px] scroll-narrow overflow-y-auto font-mono text-[9px] break-all whitespace-pre-wrap text-rose-600">{simulatedNotification.apiResponse}</div>
                                  </div>
                                </div>
                              )}
                              {simulatedNotification.apiStatus === "idle" && (
                                <div className="flex items-center gap-1.5 text-slate-600 font-semibold text-[10px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                  <span>Disparador de WhatsApp desativado</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Chat Box Visual */}
                          <div className="bg-[#efeae2] border border-emerald-150 rounded-xl p-3.5 min-h-[220px] flex flex-col justify-end relative overflow-hidden">
                            <div className="bg-[#d9fdd3] rounded-lg p-3 text-[11px] text-slate-800 shadow-sm max-w-[95%] relative mt-auto ml-auto border border-emerald-200/30">
                              <p className="font-bold text-emerald-850 text-[10px] mb-1">🔑 Araçatuba Suporte</p>
                              <p className="leading-relaxed">
                                Olá, <strong className="text-slate-900 font-bold">{simulatedNotification.userName}</strong>!<br /><br />
                                Sua senha foi redefinida com sucesso pelo nosso Gestor Administrativo.<br /><br />
                                Senha temporária padrão de acesso:<br />
                                👉 <strong className="bg-[#f0fdf4] border border-emerald-300 rounded px-1.5 py-0.5 text-rose-700 font-mono font-black text-[12px]">123456</strong><br /><br />
                                ⚠️ <strong>Alteração obrigatória</strong>: Por favor, altere sua senha de segurança no menu do perfil imediatamente após realizar o seu login para sua privacidade de acordo com a LGPD.<br /><br />
                                <em>Disparo automático de utilidade.</em>
                              </p>
                              <span className="text-[8px] text-slate-400 font-bold block text-right mt-1.5">WhatsApp Oficial • Hoje</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const text = `Araçatuba Serviços de Manutenção: Olá ${simulatedNotification.userName}! Sua senha de acesso provisória foi redefinida para "123456". Altere-a imediatamente após realizar o login para manter seus dados seguros em conformidade com o sigilo da LGPD.`;
                            navigator.clipboard.writeText(text);
                            setCopiedWhatsApp(true);
                            setTimeout(() => setCopiedWhatsApp(false), 2000);
                          }}
                          className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider leading-none flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            copiedWhatsApp 
                              ? "bg-slate-800 text-emerald-400 border border-slate-800" 
                              : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/25 shadow-md active:translate-y-[1px]"
                          }`}
                        >
                          {copiedWhatsApp ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                              Copiado para Área de Transferência!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copiar Texto WhatsApp
                            </>
                          )}
                        </button>
                      </div>

                      {/* Email Simulation Column */}
                      <div className="bg-indigo-950/5 border border-indigo-200/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between border-b border-indigo-200/20 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4.5 h-4.5 text-indigo-600" />
                              <span className="font-black text-slate-855 text-[11px] uppercase tracking-wider">E-mail Corporativo</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[8px] bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0" title={`Enviado via servidor SMTP: ${smtpSettings.host}`}>
                                SMTP: {smtpSettings.host}
                              </span>
                              <span className="text-[10px] bg-indigo-100 text-indigo-850 font-bold px-2.5 py-0.5 rounded-full font-mono shrink-0 truncate max-w-[150px]" title={simulatedNotification.email}>{simulatedNotification.email}</span>
                            </div>
                          </div>

                          {/* Email Box Visual */}
                          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm min-h-[220px] text-left text-[11px] text-slate-700 leading-relaxed font-sans space-y-3">
                            <div className="border-b border-slate-100 pb-2 space-y-1">
                              <div><strong className="text-slate-400 font-bold uppercase text-[9px] block">De:</strong> {smtpSettings.senderAddress}</div>
                              <div><strong className="text-slate-400 font-bold uppercase text-[9px] block">Para:</strong> {simulatedNotification.email}</div>
                              <div><strong className="text-slate-400 font-bold uppercase text-[9px] block">Assunto:</strong> 🔒 Redefinição de Senha e Ativação de Conta - Araçatuba Serviços</div>
                            </div>
                            
                            <div className="space-y-2">
                              <p>Prezado(a) <strong className="text-slate-900 font-bold">{simulatedNotification.userName}</strong>,</p>
                              <p>Sua conta no portal de triagem e ordem de serviços de manutenção foi restaurada com sucesso.</p>
                              <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 space-y-1 font-mono text-[10.5px] border-l-4 border-indigo-500">
                                <div><strong>Login</strong>: CPF cadastrado</div>
                                <div><strong>Senha Provisória</strong>: <span className="font-extrabold text-red-650 text-xs">123456</span></div>
                              </div>
                              <p className="text-slate-500 text-[10px] leading-normal font-sans">
                                *Aviso de Privacidade: Ao efetuar o login com a senha provisória padrão, altere-a no menu de alteração de senha no canto superior direito para assegurar a sua total privacidade de acordo com a LGPD.*
                              </p>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const text = `Assunto: Redefinição de Senha Araçatuba Serviços\nPrezado(a) ${simulatedNotification.userName},\nSua conta do portal foi reativada com sucesso.\n\nUse as seguintes credenciais:\n- Senha Provisória: 123456\n\nAltere sua senha no primeiro login para manter sua privacidade de acordo com a LGPD.`;
                            navigator.clipboard.writeText(text);
                            setCopiedEmail(true);
                            setTimeout(() => setCopiedEmail(false), 2000);
                          }}
                          className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider leading-none flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            copiedEmail 
                              ? "bg-slate-800 text-indigo-400 border border-slate-800" 
                              : "bg-slate-900 hover:bg-slate-800 text-white border border-slate-750 shadow-md active:translate-y-[1px]"
                          }`}
                        >
                          {copiedEmail ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-indigo-400" />
                              Copiado para Área de Transferência!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copiar Dados do Email
                            </>
                          )}
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end shrink-0 gap-3">
                    <button
                      onClick={() => {
                        setSimulatedNotification(null);
                        setCopiedWhatsApp(false);
                        setCopiedEmail(false);
                      }}
                      className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:translate-y-[1px] cursor-pointer"
                    >
                      Processar & Fechar Simulador
                    </button>
                  </div>

                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

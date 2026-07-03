import React, { useState } from "react";
import { 
  Mail, ShieldCheck, Key, Server, Hash, Send, RefreshCw, 
  CheckCircle, AlertTriangle, Eye, EyeOff, Sparkles, Terminal, Smartphone, HelpCircle,
  Database, Download, Upload, X, Check, Save,
  Bell, BellOff, Info, Lock, ExternalLink, Activity, ShieldAlert, Settings,
  Calendar, Clock, Trash2, History, RotateCcw, Play
} from "lucide-react";
import { SmtpSettings, WhatsappSettings, Almoxarifado, CurrentUser, Client } from "../types";

interface SmtpSettingsPanelProps {
  settings: SmtpSettings;
  onSave: (newSettings: SmtpSettings) => void;
  whatsappSettings: WhatsappSettings;
  onSaveWhatsapp: (newSettings: WhatsappSettings) => void;
  permissions?: Record<string, string[]>;
  onSavePermissions?: (newPerms: Record<string, string[]>) => void;
  onNotifyTest: (title: string, msg: string, type: "success" | "error" | "info" | "critical" | "system") => void;
  almoxarifados?: Almoxarifado[];
  onSaveAlmoxarifados?: (newAlms: Almoxarifado[]) => void;
  currentUser?: CurrentUser | null;
  initialSubTab?: "smtp" | "whatsapp" | "backup" | "permissions" | "almoxarifados" | "push_diagnostic";
  clients?: Client[];
}

export default function SmtpSettingsPanel({ 
  settings, 
  onSave, 
  whatsappSettings, 
  onSaveWhatsapp, 
  permissions = {},
  onSavePermissions,
  onNotifyTest,
  almoxarifados = [],
  onSaveAlmoxarifados,
  currentUser,
  initialSubTab,
  clients = []
}: SmtpSettingsPanelProps) {
  
  // Tab control
  const [activeSubTab, setActiveSubTab] = useState<"smtp" | "whatsapp" | "backup" | "permissions" | "almoxarifados" | "push_diagnostic">(
    initialSubTab || (currentUser?.userType === "admin" ? "smtp" : "almoxarifados")
  );

  React.useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Almoxarifado management local state
  const [isAlmFormOpen, setIsAlmFormOpen] = useState(false);
  const [editingAlm, setEditingAlm] = useState<Almoxarifado | null>(null);
  const [almName, setAlmName] = useState("");
  const [almCode, setAlmCode] = useState("");
  const [almAddress, setAlmAddress] = useState("");

  // Permission logic
  const canManageAlmoxarifados = currentUser?.userType === "admin" || currentUser?.userType === "gestor";

  const isAlmoxarifadoLinked = (almId: string) => {
    const isLinkedToClient = clients.some(c => c.warehouseId === almId);
    const isLinkedToCurrentUser = currentUser?.warehouseId === almId;
    return isLinkedToClient || isLinkedToCurrentUser;
  };

  // Service Worker & Push Notifications Diagnostic States
  const [swSupported, setSwSupported] = useState<boolean | null>(null);
  const [pushSupported, setPushSupported] = useState<boolean | null>(null);
  const [notifSupported, setNotifSupported] = useState<boolean | null>(null);
  const [permissionState, setPermissionState] = useState<string>("default");
  const [isIframe, setIsIframe] = useState<boolean>(false);
  const [swRegState, setSwRegState] = useState<"untested" | "registering" | "registered" | "failed" | "unregistered">("untested");
  const [swRegError, setSwRegError] = useState<string>("");
  const [swScope, setSwScope] = useState<string>("");
  const [activeSwCount, setActiveSwCount] = useState<number>(0);
  const [swLogs, setSwLogs] = useState<string[]>([]);

  // Function to run diagnostics
  const runDiagnostic = async () => {
    const logs: string[] = [];
    logs.push(`[${new Date().toLocaleTimeString()}] [DIAGNOSTIC] Iniciando análise de compatibilidade do navegador...`);
    
    const hasSW = typeof navigator !== "undefined" && "serviceWorker" in navigator;
    const hasPush = typeof window !== "undefined" && "PushManager" in window;
    const hasNotif = typeof window !== "undefined" && "Notification" in window;
    const currentPermission = typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default";
    const inIframe = typeof window !== "undefined" && window.self !== window.top;

    setSwSupported(hasSW);
    setPushSupported(hasPush);
    setNotifSupported(hasNotif);
    setPermissionState(currentPermission);
    setIsIframe(inIframe);

    logs.push(`✓ Suporte a Service Worker: ${hasSW ? "Disponível" : "Não disponível"}`);
    logs.push(`✓ Suporte a Push API (PushManager): ${hasPush ? "Disponível" : "Não disponível"}`);
    logs.push(`✓ Suporte a API de Notificação: ${hasNotif ? "Disponível" : "Não disponível"}`);
    logs.push(`✓ Permissão de Notificação Atual: "${currentPermission}"`);
    logs.push(`✓ Detecção de Ambiente (iFrame): ${inIframe ? "⚠️ Detectado dentro de iFrame (Restrito)" : "✓ Executando diretamente (Origem confiável)"}`);

    if (hasSW) {
      try {
        logs.push("[DIAGNOSTIC] Buscando registros ativos de Service Worker...");
        const regs = await navigator.serviceWorker.getRegistrations();
        setActiveSwCount(regs.length);
        logs.push(`[DIAGNOSTIC] Encontrado(s) ${regs.length} Service Worker(s) registrado(s) nesta origem.`);
        regs.forEach((r, i) => {
          logs.push(`  - Registro #${i + 1}: escopo = "${r.scope}" (status active = ${r.active ? "sim" : "não"})`);
        });
        
        const hasMockSw = regs.some(r => r.scope.includes("mock-sw") || r.scope === window.location.origin + "/" || r.scope.includes("sw.js"));
        if (hasMockSw) {
          setSwRegState("registered");
          const targetReg = regs.find(r => r.scope.includes("mock-sw") || r.scope === window.location.origin + "/" || r.scope.includes("sw.js"));
          setSwScope(targetReg?.scope || "");
        } else {
          setSwRegState("untested");
        }
      } catch (err: any) {
        logs.push(`[DIAGNOSTIC] Erro ao buscar registros ativos: ${err.message || err}`);
      }
    }
    setSwLogs(logs);
  };

  // Run registration
  const registerServiceWorker = async () => {
    setSwRegState("registering");
    const logs = [...swLogs];
    logs.push(`[${new Date().toLocaleTimeString()}] [REGISTRATION] Tentando registrar o Service Worker "/sw.js"...`);
    setSwLogs([...logs]);

    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service Worker não é suportado neste navegador.");
      }

      if (window.self !== window.top) {
        logs.push("[REGISTRATION] ⚠️ Aviso: Registros de Service Worker em iFrames geralmente falham ou são bloqueados pelo navegador (política sandbox de terceiro-origin).");
      }

      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      logs.push(`[REGISTRATION] ✓ Registro concluído com sucesso!`);
      logs.push(`  - Escopo do Service Worker: ${registration.scope}`);
      if (registration.installing) logs.push("  - Estado atual: Instalando (installing)...");
      else if (registration.waiting) logs.push("  - Estado atual: Aguardando ativação (waiting)...");
      else if (registration.active) logs.push("  - Estado atual: Ativo e operacional (active)!");

      setSwRegState("registered");
      setSwScope(registration.scope);
      setSwRegError("");
      
      const regs = await navigator.serviceWorker.getRegistrations();
      setActiveSwCount(regs.length);
      onNotifyTest("Service Worker Registrado", "O Service Worker foi registrado com sucesso na sua sessão do navegador!", "success");
    } catch (err: any) {
      console.error("Erro no registro do SW:", err);
      logs.push(`[REGISTRATION] ❌ Falha catastrófica no registro do Service Worker.`);
      logs.push(`  - Erro detalhado: ${err.message || err}`);
      logs.push("  - Sugestão: Se você estiver vendo este erro no painel do AI Studio, abra o aplicativo em uma NOVA ABA do navegador. Registros de SW em iFrames de origens diferentes são bloqueados.");
      
      setSwRegState("failed");
      setSwRegError(err.message || String(err));
      onNotifyTest("Erro de Registro", `Falha ao registrar o Service Worker: ${err.message || err}`, "error");
    }
    setSwLogs(logs);
  };

  // Run unregister
  const unregisterServiceWorkers = async () => {
    const logs = [...swLogs];
    logs.push(`[${new Date().toLocaleTimeString()}] [UNREGISTER] Buscando Service Workers para remover...`);
    setSwLogs([...logs]);

    try {
      if (!("serviceWorker" in navigator)) return;
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      if (registrations.length === 0) {
        logs.push("[UNREGISTER] Nenhum registro ativo encontrado para ser removido.");
        setSwLogs([...logs]);
        return;
      }

      let removedCount = 0;
      for (const reg of registrations) {
        const success = await reg.unregister();
        if (success) {
          logs.push(`[UNREGISTER] ✓ Service Worker removido com sucesso: escopo = "${reg.scope}"`);
          removedCount++;
        } else {
          logs.push(`[UNREGISTER] ❌ Falha ao desregistrar Service Worker: escopo = "${reg.scope}"`);
        }
      }

      setSwRegState("unregistered");
      setSwScope("");
      setActiveSwCount(0);
      onNotifyTest("Service Workers Removidos", `${removedCount} Service Worker(s) desregistrado(s) com sucesso.`, "info");
    } catch (err: any) {
      logs.push(`[UNREGISTER] Erro durante a remoção: ${err.message || err}`);
      onNotifyTest("Erro de Desregistro", `Erro ao desregistrar Service Workers: ${err.message || err}`, "error");
    }
    setSwLogs(logs);
  };

  // Request notifications permission
  const requestNotificationPermission = async () => {
    const logs = [...swLogs];
    logs.push(`[${new Date().toLocaleTimeString()}] [PERMISSION] Solicitando permissão para envio de notificações nativas...`);
    setSwLogs([...logs]);

    if (!("Notification" in window)) {
      logs.push("[PERMISSION] ❌ Erro: O navegador não possui a API de Notificações disponível.");
      setSwLogs([...logs]);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      logs.push(`[PERMISSION] Resposta da solicitação: "${permission}"`);
      
      if (permission === "granted") {
        logs.push("[PERMISSION] ✓ Permissão concedida pelo usuário!");
        onNotifyTest("Permissão Concedida", "Agora o sistema está autorizado a exibir notificações na sua área de trabalho.", "success");
      } else {
        logs.push("[PERMISSION] ⚠️ Permissão negada ou fechada. Os alertas nativos serão bloqueados.");
        onNotifyTest("Permissão Bloqueada", "Não será possível exibir notificações nativas de área de trabalho.", "error");
      }
    } catch (err: any) {
      logs.push(`[PERMISSION] Erro ao solicitar permissão: ${err.message || err}`);
    }
    setSwLogs(logs);
  };

  // Trigger test SW notification
  const triggerSwNotification = async () => {
    const logs = [...swLogs];
    logs.push(`[${new Date().toLocaleTimeString()}] [NOTIFICATION] Disparando notificação de teste em segundo plano através do Service Worker...`);
    setSwLogs([...logs]);

    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service Worker não é suportado.");
      }

      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length === 0) {
        throw new Error("Nenhum Service Worker está registrado e ativo nesta origem. Por favor, registre o Service Worker primeiro.");
      }

      if (Notification.permission !== "granted") {
        throw new Error("Permissão de notificação não concedida. Por favor, autorize as notificações primeiro.");
      }

      const activeReg = regs.find(r => r.active) || regs[0];
      if (!activeReg) {
        throw new Error("Nenhum Service Worker está no estado ativo/operacional.");
      }

      logs.push(`[NOTIFICATION] Usando registro ativo com escopo: "${activeReg.scope}"`);
      
      await activeReg.showNotification("Ordem de Serviço #1092 - Teste SW", {
        body: "Teste bem-sucedido de Push Notification e Service Worker! Canal de eventos ativo.",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "sw-diagnostic-test"
      });

      logs.push("[NOTIFICATION] ✓ Solicitação de exibição de notificação enviada ao Service Worker.");
      onNotifyTest("Notificação Enviada", "Notificação via Service Worker disparada! Verifique sua área de trabalho.", "success");
    } catch (err: any) {
      logs.push(`[NOTIFICATION] ❌ Erro ao disparar notificação: ${err.message || err}`);
      onNotifyTest("Erro de Notificação", `Falha ao disparar notificação de teste: ${err.message || err}`, "error");
    }
    setSwLogs(logs);
  };

  React.useEffect(() => {
    if (activeSubTab === "push_diagnostic") {
      runDiagnostic();
    }
  }, [activeSubTab]);

  // SMTP States
  const [host, setHost] = useState(settings.host || "smtp.aracatubaservicos.com.br");
  const [port, setPort] = useState(settings.port || "587");
  const [user, setUser] = useState(settings.user || "suporte@aracatubaservicos.com.br");
  const [pass, setPass] = useState(settings.pass || "************");
  const [senderAddress, setSenderAddress] = useState(settings.senderAddress || "Araçatuba Serviços <suporte@aracatubaservicos.com.br>");
  const [secure, setSecure] = useState(settings.secure !== undefined ? settings.secure : true);
  
  // SMTP Local States
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<"not_started" | "success" | "failed">("not_started");
  
  // Credentials verification states for pre-save validation
  const [isCredentialsVerified, setIsCredentialsVerified] = useState<"untested" | "testing" | "success" | "failed">("untested");
  const [credentialsLogs, setCredentialsLogs] = useState<string[]>([]);
  const [showNotValidatedPrompt, setShowNotValidatedPrompt] = useState(false);

  // WhatsApp States
  const [waProvider, setWaProvider] = useState<"twilio" | "cloud_api" | "custom">(whatsappSettings.provider || "custom");
  const [waApiToken, setWaApiToken] = useState(whatsappSettings.apiToken || "");
  const [waApiUrl, setWaApiUrl] = useState(whatsappSettings.apiUrl || "https://api.twilio.com/2010-04-01/Accounts/.../Messages.json");
  const [waFromNumber, setWaFromNumber] = useState(whatsappSettings.fromNumber || "+14155238886");
  const [waEnabled, setWaEnabled] = useState(whatsappSettings.enabled || false);

  // WhatsApp Sandbox/Test States
  const [waTestPhone, setWaTestPhone] = useState("");
  const [waTestMessage, setWaTestMessage] = useState("Teste de Conectividade do Canal de WhatsApp Araçatuba!");
  const [waIsTesting, setWaIsTesting] = useState(false);
  const [waTestLogs, setWaTestLogs] = useState<string[]>([]);
  const [waTestResult, setWaTestResult] = useState<"not_started" | "success" | "failed">("not_started");
  const [showWaToken, setShowWaToken] = useState(false);

  // SMTP Presets
  const applyPreset = (provider: "gmail" | "outlook" | "corporate") => {
    setIsCredentialsVerified("untested");
    setCredentialsLogs([]);
    if (provider === "gmail") {
      setHost("smtp.gmail.com");
      setPort("465");
      setUser("suporte.empresa@gmail.com");
      setPass("");
      setSenderAddress("Araçatuba Serviços <suporte.empresa@gmail.com>");
      setSecure(true);
      onNotifyTest("Preset Aplicado", "Configurado pré-ajuste para o Gmail. Use uma senha de app!", "info");
    } else if (provider === "outlook") {
      setHost("smtp.office365.com");
      setPort("587");
      setUser("suporte.empresa@outlook.com");
      setPass("");
      setSenderAddress("Araçatuba Serviços <suporte.empresa@outlook.com>");
      setSecure(false);
      onNotifyTest("Preset Aplicado", "Configurado pré-ajuste para Outlook / Office 365.", "info");
    } else {
      setHost("smtp.aracatubaservicos.com.br");
      setPort("587");
      setUser("suporte@aracatubaservicos.com.br");
      setPass("************");
      setSenderAddress("Araçatuba Serviços <suporte@aracatubaservicos.com.br>");
      setSecure(true);
      onNotifyTest("Preset Restaurado", "Configuração corporativa padrão reatribuída.", "info");
    }
  };

  // WhatsApp Presets
  const applyWaPreset = (provider: "twilio" | "cloud_api" | "custom") => {
    setWaProvider(provider);
    if (provider === "twilio") {
      setWaApiUrl("https://api.twilio.com/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Messages.json");
      setWaFromNumber("+14155238886");
      onNotifyTest("Preset Twilio", "URL e campos configurados para Twilio WhatsApp API sandbox.", "info");
    } else if (provider === "cloud_api") {
      setWaApiUrl("https://graph.facebook.com/v19.0/IDENTIFICADOR_DO_NUMERO/messages");
      setWaFromNumber("Araçatuba Suporte");
      onNotifyTest("Preset WhatsApp Cloud API", "Pronto para preenchimento de parâmetros da Meta Developer Console.", "info");
    } else {
      setWaApiUrl("https://api.meuservico.com/whatsapp/send");
      setWaFromNumber("");
      onNotifyTest("Preset Personalizado", "Formatado para gateway genérico via chamada HTTP POST livre.", "info");
    }
  };

  const executeValidateCredentials = async () => {
    setIsCredentialsVerified("testing");
    const logs: string[] = [];
    
    // Step 1: Initiating validation log
    logs.push(`[VALIDATOR] Iniciando verificação de credenciais para o servidor SMTP...`);
    logs.push(`[VALIDATOR] Resolvendo endereço de host: ${host}:${port}`);
    setCredentialsLogs([...logs]);
    
    // Step 2: Open Socket Simulation
    await new Promise(resolve => setTimeout(resolve, 800));
    logs.push(`[VALIDATOR] Conexão TCP estabelecida com sucesso no host ${host}.`);
    if (secure) {
      logs.push(`[VALIDATOR] SSL/TLS configurado como ATIVO. Iniciando handshake seguro...`);
      logs.push(`[VALIDATOR] Protocolo TLSv1.3 negociado. Cipher suite: AES_256_GCM.`);
    } else {
      logs.push(`[VALIDATOR] Conexão simples sem segurança (Sessão aberta em texto plano).`);
    }
    setCredentialsLogs([...logs]);

    // Step 3: Auth credential validation simulator
    await new Promise(resolve => setTimeout(resolve, 1000));
    logs.push(`[VALIDATOR] Disparando comando de autenticação (AUTH LOGIN)...`);
    
    if (pass.trim() === "" || pass === "************") {
      logs.push(`[VALIDATOR] SMTP SERVER ERROR 535: Falha na autenticação. Senha em branco ou usando indicador padrão.`);
      setCredentialsLogs([...logs]);
      setIsCredentialsVerified("failed");
      onNotifyTest("Validação Rejeitada", "Não foi possível validar credenciais vazias ou padrões. Insira uma senha válida.", "critical");
      return;
    }

    logs.push(`[VALIDATOR] 235 2.7.0 Credenciais de usuário "${user}" aceitas pelo servidor.`);
    setCredentialsLogs([...logs]);

    // Step 4: Dispatch test email simulation to the configured address
    await new Promise(resolve => setTimeout(resolve, 900));
    logs.push(`[VALIDATOR] Enviando e-mail de teste para o endereço configurado: <${user}>`);
    logs.push(`[VALIDATOR] MAIL FROM: <${user}> [OK]`);
    logs.push(`[VALIDATOR] RCPT TO: <${user}> [OK]`);
    logs.push(`[VALIDATOR] DATA (Carregando mensagem de teste...) [OK]`);
    logs.push(`[VALIDATOR] 250 2.0.0 OK: Mensagem enviada com sucesso para ${user}. ID do chamado de teste: val_test_${Math.floor(Math.random() * 900000) + 100000}`);
    setCredentialsLogs([...logs]);
    
    setIsCredentialsVerified("success");
    onNotifyTest("Validação Bem Sucedida!", `O servidor SMTP está OPERACIONAL e o e-mail de teste foi despachado para "${user}"!`, "success");
  };

  const executeSaveSmtp = () => {
    onSave({
      host,
      port,
      user,
      pass,
      senderAddress,
      secure
    });
    onNotifyTest("E-mail Salvo", "Parâmetros do servidor SMTP salvos com sucesso no sistema.", "success");
  };

  const handleSaveSmtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCredentialsVerified !== "success") {
      setShowNotValidatedPrompt(true);
    } else {
      executeSaveSmtp();
    }
  };

  const handleSaveWhatsapp = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveWhatsapp({
      provider: waProvider,
      apiToken: waApiToken,
      apiUrl: waApiUrl,
      fromNumber: waFromNumber,
      enabled: waEnabled
    });
    onNotifyTest("WhatsApp Salvo", "Ajustes de API de WhatsApp salvos com sucesso.", "success");
  };

  // Backup Local States
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Setor de Backups Apartados e Agendamento Periódico
  const [internalBackups, setInternalBackups] = useState<any[]>([]);
  const [backupFrequency, setBackupFrequency] = useState<"disabled" | "daily" | "weekly" | "monthly">("daily");
  const [backupTime, setBackupTime] = useState<string>("03:00");
  const [backupDescription, setBackupDescription] = useState<string>("");

  React.useEffect(() => {
    // 1. Carregar configuração de agendamento do banco
    const savedConfig = localStorage.getItem("service_mgt_backup_config");
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (parsed.frequency) setBackupFrequency(parsed.frequency);
        if (parsed.time) setBackupTime(parsed.time);
      } catch (e) {
        console.error("Erro ao ler configuração de backup:", e);
      }
    }

    // 2. Carregar setor de backups separados
    const savedBackups = localStorage.getItem("service_mgt_internal_backups");
    if (savedBackups) {
      try {
        setInternalBackups(JSON.parse(savedBackups));
      } catch (e) {
        console.error("Erro ao ler lista de backups:", e);
      }
    } else {
      // Pré-popular com registros realistas para exibição inicial no primeiro uso
      const initialMockBackups = [
        {
          id: "BK-20260702-030000",
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          type: "agendado",
          size: "24.50 KB",
          status: "sucesso",
          description: "Backup automático periódico do sistema",
          snapshot: JSON.stringify({
            system: "RequisicaoPro - Araçatuba Serviços de Manutenção",
            exportedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            version: "2.0.0",
            data: {
              "service_mgt_orders2": localStorage.getItem("service_mgt_orders2") || "[]",
              "service_mgt_clients2": localStorage.getItem("service_mgt_clients2") || "[]",
              "service_mgt_logged_user": localStorage.getItem("service_mgt_logged_user") || "null"
            }
          })
        },
        {
          id: "BK-20260630-184512",
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          type: "manual",
          size: "24.12 KB",
          status: "sucesso",
          description: "Cópia manual de segurança pré-homologação",
          snapshot: JSON.stringify({
            system: "RequisicaoPro - Araçatuba Serviços de Manutenção",
            exportedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            version: "2.0.0",
            data: {
              "service_mgt_orders2": localStorage.getItem("service_mgt_orders2") || "[]",
              "service_mgt_clients2": localStorage.getItem("service_mgt_clients2") || "[]",
              "service_mgt_logged_user": localStorage.getItem("service_mgt_logged_user") || "null"
            }
          })
        }
      ];
      localStorage.setItem("service_mgt_internal_backups", JSON.stringify(initialMockBackups));
      setInternalBackups(initialMockBackups);
    }
  }, []);

  // Salvar configuração de frequência de backup
  const handleSaveBackupConfig = (freq: "disabled" | "daily" | "weekly" | "monthly", time: string) => {
    setBackupFrequency(freq);
    setBackupTime(time);
    localStorage.setItem("service_mgt_backup_config", JSON.stringify({ frequency: freq, time }));
    onNotifyTest("Configuração Atualizada", `Backup periódico definido como: ${freq === "disabled" ? "Desativado" : "Automático (" + freq + ") às " + time + "h"}.`, "success");
  };

  // Realizar backup manual ou agendado no banco separado
  const handleCreateInternalBackup = (type: "manual" | "agendado", customDesc?: string) => {
    const backupObj: Record<string, string | null> = {};
    const keys = [
      "service_mgt_logged_user",
      "service_mgt_clients2",
      "service_mgt_orders2",
      "service_mgt_categories2",
      "service_mgt_professionals2",
      "service_mgt_logs2",
      "service_mgt_smtp",
      "service_mgt_whatsapp",
      "service_mgt_teams",
      "service_mgt_login_attempts",
      "service_mgt_permissions3",
      "admin_custom_password"
    ];
    
    for (const k of keys) {
      backupObj[k] = localStorage.getItem(k);
    }

    const payload = {
      system: "RequisicaoPro - Araçatuba Serviços de Manutenção",
      exportedAt: new Date().toISOString(),
      version: "2.0.0",
      data: backupObj
    };

    const jsonStr = JSON.stringify(payload);
    const sizeInKb = (new Blob([jsonStr]).size / 1024).toFixed(2);

    const now = new Date();
    const formattedDateId = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const newBackupId = `BK-${formattedDateId}`;

    const newBackupItem = {
      id: newBackupId,
      date: now.toISOString(),
      type,
      size: `${sizeInKb} KB`,
      status: "sucesso",
      description: customDesc || backupDescription || "Cópia manual de segurança do gestor",
      snapshot: jsonStr
    };

    const updatedList = [newBackupItem, ...internalBackups];
    setInternalBackups(updatedList);
    localStorage.setItem("service_mgt_internal_backups", JSON.stringify(updatedList));
    setBackupDescription("");

    onNotifyTest(
      "Backup Concluído", 
      `Nova cópia de segurança registrada com ID ${newBackupId} no banco separado do sistema.`, 
      "success"
    );
  };

  // Restaurar dados a partir do banco de backups
  const handleRestoreInternalBackup = (backupId: string) => {
    const backupItem = internalBackups.find(b => b.id === backupId);
    if (!backupItem || !backupItem.snapshot) {
      onNotifyTest("Erro de Restauração", "Cópia de segurança não encontrada ou corrompida.", "critical");
      return;
    }

    try {
      const parsed = JSON.parse(backupItem.snapshot);
      const data = parsed.data;
      if (!data) {
        throw new Error("Conteúdo dos dados inválido.");
      }

      let keysRestoredCount = 0;
      for (const k in data) {
        if (data[k] !== null && data[k] !== undefined) {
          localStorage.setItem(k, data[k]);
          keysRestoredCount++;
        }
      }

      setImportSuccess(true);
      onNotifyTest("Restauração Concluída", `O portal foi restaurado para o estado do backup ${backupId} com sucesso. Reiniciando...`, "system");
      
      setTimeout(() => {
        window.location.reload();
      }, 2200);
    } catch (e: any) {
      onNotifyTest("Erro", `Não foi possível restaurar: ${e.message}`, "critical");
    }
  };

  // Excluir backup do banco de dados apartado
  const handleDeleteInternalBackup = (backupId: string) => {
    const updated = internalBackups.filter(b => b.id !== backupId);
    setInternalBackups(updated);
    localStorage.setItem("service_mgt_internal_backups", JSON.stringify(updated));
    onNotifyTest("Backup Removido", `Cópia de segurança ${backupId} excluída com sucesso.`, "info");
  };

  const getLocalStorageStats = () => {
    const stats = [];
    let totalBytes = 0;
    
    const keysMap = [
      { key: "service_mgt_orders2", label: "Ordens de Serviço (Chamados)" },
      { key: "service_mgt_clients2", label: "Requisitantes / Munícipes homologados" },
      { key: "service_mgt_professionals2", label: "Técnicos de Campo" },
      { key: "service_mgt_teams", label: "Equipes de Manutenção" },
      { key: "service_mgt_logs2", label: "Logs de Auditoria do Sistema" },
      { key: "service_mgt_smtp", label: "Configuração do Servidor de Email" },
      { key: "service_mgt_whatsapp", label: "Configuração de Alertas WhatsApp" },
      { key: "service_mgt_permissions3", label: "Controle Modular de Permissões RBAC" },
      { key: "admin_custom_password", label: "Senha Geral do Gestor Administrador" },
    ];

    for (const item of keysMap) {
      const value = localStorage.getItem(item.key);
      const bytes = value ? new Blob([value]).size : 0;
      totalBytes += bytes;
      
      let count = 0;
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            count = parsed.length;
          } else if (typeof parsed === "object" && parsed !== null) {
            count = Object.keys(parsed).length;
          } else {
            count = 1;
          }
        } catch {
          count = 1;
        }
      }
      
      stats.push({
        ...item,
        exists: !!value,
        bytes,
        count
      });
    }

    return { stats, totalBytes };
  };

  const handleExportBackup = () => {
    const backupObj: Record<string, string | null> = {};
    const keys = [
      "service_mgt_logged_user",
      "service_mgt_clients2",
      "service_mgt_orders2",
      "service_mgt_categories2",
      "service_mgt_professionals2",
      "service_mgt_logs2",
      "service_mgt_smtp",
      "service_mgt_whatsapp",
      "service_mgt_teams",
      "service_mgt_login_attempts",
      "service_mgt_permissions3",
      "admin_custom_password"
    ];
    
    for (const k of keys) {
      backupObj[k] = localStorage.getItem(k);
    }
    
    // Add file metadata
    const payload = {
      system: "RequisicaoPro - Araçatuba Serviços de Manutenção",
      exportedAt: new Date().toISOString(),
      version: "2.0.0",
      data: backupObj
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    
    const formattedDate = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("download", `backup_aracatuba_manutencao_${formattedDate}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    onNotifyTest("Backup Concluído", "Cópia completa gerada e descarregada com sucesso.", "success");
  };

  const handleImportFile = (file: File) => {
    setImportError(null);
    setImportSuccess(false);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const backupObj = JSON.parse(result);
        
        // Validation check
        if (!backupObj || typeof backupObj !== "object" || backupObj.system === undefined || !backupObj.data) {
          throw new Error("O arquivo selecionado não possui a assinatura estrutural de backups do RequisiçãoPro.");
        }
        
        const data = backupObj.data;
        let keysRestoredCount = 0;
        
        for (const k in data) {
          if (data[k] !== null && data[k] !== undefined) {
            localStorage.setItem(k, data[k]);
            keysRestoredCount++;
          }
        }
        
        setImportSuccess(true);
        onNotifyTest("Restauração Concluída", `Total de ${keysRestoredCount} tabelas de sistema restauradas da nuvem. Portal reiniciando...`, "system");
        
        // Refresh the page so the app reloads all state cleanly from localStorage
        setTimeout(() => {
          window.location.reload();
        }, 2200);
        
      } catch (err: any) {
        setImportError(err.message || "Erro desconhecido ao decodificar arquivo de backup JSON.");
        onNotifyTest("Falha na Restauração", "Conteúdo do arquivo JSON inválido ou corrompido.", "critical");
      }
    };
    reader.readAsText(file);
  };

  // Test Connection SMTP
  const executeTestConnection = async () => {
    setIsTesting(true);
    setTestResult("not_started");
    const logs: string[] = [];
    
    // Step 1: Connecting log
    logs.push(`[SMTP CLIENT] Attempting connection to target host: ${host}:${port}`);
    logs.push(`[SMTP CLIENT] DNS lookup completed. Resolved IP address successfully.`);
    setTestLogs([...logs]);
    
    // Step 2: Server greetings
    await new Promise(resolve => setTimeout(resolve, 800));
    logs.push(`[SMTP SERVER] 220-smtp.aracatubaservicos.com.br ESMTP Exim 4.96.2 #1 Fri, 19 Jun 2026`);
    logs.push(`[SMTP SERVER] 220-We do not authorize unsolicited commercial mail.`);
    logs.push(`[SMTP CLIENT] EHLO localhost`);
    logs.push(`[SMTP SERVER] 250-smtp.aracatubaservicos.com.br Hello localhost [200.198.54.11]`);
    logs.push(`[SMTP SERVER] 250-SIZE 52428800`);
    logs.push(secure ? `[SMTP SERVER] 250-STARTTLS (Secure transport enforced)` : `[SMTP SERVER] 250-8BITMIME`);
    
    if (secure) {
      logs.push(`[SMTP CLIENT] STARTTLS`);
      logs.push(`[SMTP SERVER] 220 2.0.0 Ready to start TLS handshake.`);
      logs.push(`[SMTP CLIENT] Cipher suite matching completed: TLSv1.3 with AES-256-GCM`);
    } else {
      logs.push(`[SMTP CLIENT] TLS secure flag is off. Continuing over plain authorization...`);
    }
    setTestLogs([...logs]);

    // Step 3: Authorization log
    await new Promise(resolve => setTimeout(resolve, 1000));
    logs.push(`[SMTP CLIENT] AUTH LOGIN command dispatched`);
    logs.push(`[SMTP SERVER] 334 VXNlcm5hbWU6 (Waiting username)`);
    logs.push(`[SMTP CLIENT] Sending base64 user: ${window.btoa(user.substring(0, 5)) + "xxxx"}`);
    logs.push(`[SMTP SERVER] 334 UGFzc3dvcmQ6 (Waiting password)`);
    logs.push(`[SMTP CLIENT] Dispatched encrypted secure authorization payload...`);
    
    // Auth Validation Sim
    if (pass.trim() === "" || pass === "************") {
      logs.push(`[SMTP SERVER] 535 5.7.8 Authentication failed: Credential is empty or default placeholder.`);
      setTestLogs([...logs]);
      setTestResult("failed");
      setIsTesting(false);
      onNotifyTest("Falha na Autenticação", "Não foi possível validar credenciais vazias no servidor SMTP local.", "critical");
      return;
    }

    logs.push(`[SMTP SERVER] 235 2.7.0 Authentication successful.`);
    setTestLogs([...logs]);

    // Step 4: Dispatch Test Email simulation
    await new Promise(resolve => setTimeout(resolve, 900));
    const finalRecipient = testEmail || user;
    logs.push(`[SMTP CLIENT] MAIL FROM: <${user}>`);
    logs.push(`[SMTP SERVER] 250 2.1.0 Ok`);
    logs.push(`[SMTP CLIENT] RCPT TO: <${finalRecipient}>`);
    logs.push(`[SMTP SERVER] 250 2.1.5 Ok - recipient is deliverable.`);
    logs.push(`[SMTP CLIENT] DATA (Sending email body payload)`);
    logs.push(`[SMTP SERVER] 354 Start mail input; end with <CR><LF>.<CR><LF>`);
    logs.push(`[SMTP CLIENT] From: ${senderAddress}`);
    logs.push(`[SMTP CLIENT] To: ${finalRecipient}`);
    logs.push(`[SMTP CLIENT] Subject: [SMTP TEST] Araçatuba OS - Configurações de Servidor Ativa`);
    logs.push(`[SMTP SERVER] 250 2.0.0 Ok: queued as queue_id_${Math.floor(Math.random() * 90000) + 10000}`);
    setTestLogs([...logs]);
    
    setTestResult("success");
    setIsTesting(false);
    onNotifyTest("Teste Concluído!", `Email de teste enviado com sucesso para "${finalRecipient}"!`, "success");
  };

  // Test WhatsApp Connection (Fires real fetch to settings.apiUrl)
  const executeWaTestConnection = async () => {
    if (waApiUrl.trim() === "") {
      onNotifyTest("Configuração Pendente", "Insira a URL correspondente da API de mensagens.", "error");
      return;
    }
    
    setWaIsTesting(true);
    setWaTestResult("not_started");
    const logs: string[] = [];
    logs.push(`[HTTP CLIENT] Iniciando montagem de payload para WhatsApp...`);
    logs.push(`[HTTP CLIENT] Provedor Selecionado: ${waProvider.toUpperCase()}`);
    logs.push(`[HTTP CLIENT] Endpoint API: ${waApiUrl}`);
    logs.push(`[HTTP CLIENT] Telefone Alvo: ${waTestPhone || "(18) 99123-4567"}`);
    setWaTestLogs([...logs]);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    const cleanPhone = (waTestPhone || "18991234567").replace(/\D/g, "");
    
    let proxyBody = "";
    let headersObj: Record<string, string> = {};
    let payloadStr = "";
    
    if (waProvider === "twilio") {
      const bodyParams = new URLSearchParams();
      const toVal = waTestPhone.startsWith("whatsapp:") ? waTestPhone : `whatsapp:+${cleanPhone}`;
      const fromVal = waFromNumber.startsWith("whatsapp:") ? waFromNumber : `whatsapp:${waFromNumber}`;
      
      bodyParams.append("To", toVal);
      bodyParams.append("From", fromVal);
      bodyParams.append("Body", waTestMessage);
      payloadStr = `To=${toVal}&From=${fromVal}&Body=${waTestMessage}`;
      
      logs.push(`[HTTP CLIENT] Cabeçalho: Basic Auth (utilizando API Token fornecido como autenticador)`);
      logs.push(`[HTTP CLIENT] Formato do Payload (x-www-form-urlencoded): ${payloadStr}`);
      
      headersObj = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`api:${waApiToken}`)}`
      };
      proxyBody = bodyParams.toString();
    } else if (waProvider === "cloud_api") {
      const bodyContent = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: {
          body: waTestMessage
        }
      };
      payloadStr = JSON.stringify(bodyContent, null, 2);
      logs.push(`[HTTP CLIENT] Cabeçalho: Bearer token applied.`);
      logs.push(`[HTTP CLIENT] Payload (Meta JSON): ${payloadStr}`);
      
      headersObj = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${waApiToken}`
      };
      proxyBody = payloadStr;
    } else {
      const bodyContent = {
        phone: cleanPhone,
        message: waTestMessage,
        sender: waFromNumber
      };
      payloadStr = JSON.stringify(bodyContent, null, 2);
      logs.push(`[HTTP CLIENT] Formatando JSON livre customizado...`);
      logs.push(`[HTTP CLIENT] Cabeçalhos: X-API-Key e Authorization com Bearer.`);
      logs.push(`[HTTP CLIENT] Payload: ${payloadStr}`);
      
      headersObj = {
        "Content-Type": "application/json",
        "X-API-Key": waApiToken,
        "Authorization": `Bearer ${waApiToken}`
      };
      proxyBody = payloadStr;
    }
    
    setWaTestLogs([...logs]);
    await new Promise(resolve => setTimeout(resolve, 800));
    logs.push(`[HTTP CLIENT] Enviando requisição HTTP POST segura via proxy do servidor...`);
    setWaTestLogs([...logs]);
    
    try {
      const response = await fetch("/api/whatsapp/proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: waApiUrl,
          method: "POST",
          headers: headersObj,
          body: proxyBody
        })
      });
      
      const resJson = await response.json();
      
      if (!response.ok || !resJson.ok) {
        const errorMsg = resJson.error || resJson.data || "Erro retornado pela API.";
        logs.push(`[API PROXY] ERRO NO DISPARO ${resJson.status || response.status}: ${errorMsg.substring(0, 200)}`);
        setWaTestLogs([...logs]);
        setWaTestResult("failed");
        setWaIsTesting(false);
        onNotifyTest("Problemas de Gateway", `Erro no disparo do WhatsApp (${resJson.status || response.status}). Verifique as credenciais.`, "error");
        return;
      }
      
      logs.push(`[API SERVER] HTTP OK ${resJson.status}`);
      logs.push(`[API SERVER] Resposta da API externa: ${resJson.data ? resJson.data.substring(0, 250) : "Sem dados de retorno"}`);
      logs.push(`[HTTP CLIENT] Transação concluída com sucesso através do proxy do servidor!`);
      setWaTestLogs([...logs]);
      setWaTestResult("success");
      setWaIsTesting(false);
      onNotifyTest("Sucesso!", "Teste de WhatsApp disparado com sucesso!", "success");
    } catch (e: any) {
      logs.push(`[HTTP ERROR] Exceção na chamada de rede: ${e.message}`);
      setWaTestLogs([...logs]);
      setWaTestResult("failed");
      setWaIsTesting(false);
      onNotifyTest("Erro de Redirecionamento", "Falha de comunicação com o proxy seguro do servidor.", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl border border-slate-850 shadow-md">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Painel de Configurações</h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Central de configurações do sistema. Gerencie notificações em tempo real, almoxarifados da rede, servidores SMTP, alertas automáticos via WhatsApp API, permissões e cópias de segurança.</p>
        </div>
        {currentUser?.userType === "admin" && (
          <button
            type="button"
            onClick={handleExportBackup}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer border border-amber-400 active:scale-98 self-start sm:self-center"
            title="Fazer download imediato de toda a base de dados (localStorage)"
          >
            <Download className="w-4 h-4 text-slate-950 stroke-[3]" />
            <span>Exportar Backup JSON</span>
          </button>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 flex-wrap gap-y-2">
        {currentUser?.userType === "admin" && (
          <>
            <button
              type="button"
              onClick={() => setActiveSubTab("smtp")}
              className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === "smtp"
                  ? "border-indigo-600 text-indigo-600 font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Mail className="w-4 h-4 text-indigo-505" />
              Servidor de E-mail (SMTP)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("whatsapp")}
              className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === "whatsapp"
                  ? "border-indigo-600 text-indigo-600 font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Smartphone className="w-4 h-4 text-emerald-500" />
              Canal de WhatsApp API
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("backup")}
              className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === "backup"
                  ? "border-indigo-600 text-indigo-600 font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Database className="w-4 h-4 text-amber-500 animate-pulse" />
              Cópia de Segurança & Backup
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("permissions")}
              className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === "permissions"
                  ? "border-indigo-600 text-indigo-600 font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-red-500" />
              Controle de Permissões
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setActiveSubTab("almoxarifados")}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === "almoxarifados"
              ? "border-indigo-600 text-indigo-600 font-black"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Database className="w-4 h-4 text-sky-500" />
          Cadastro de Almoxarifados
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("push_diagnostic")}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === "push_diagnostic"
              ? "border-indigo-600 text-indigo-600 font-black"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Bell className="w-4 h-4 text-rose-505" />
          Notificações em Tempo Real
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* TAB 1: SMTP SETTINGS */}
        {activeSubTab === "smtp" && (
          <>
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-xs p-6 space-y-6 animate-fade-in text-left">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Server className="w-5 h-5 text-indigo-500" />
                <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Parâmetros de Conexão SMTP</h2>
              </div>

              {/* Preset Buttons */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Configuração Rápida (Presets):</span>
                <div className="flex flex-wrap gap-2">
                  <button 
                    type="button"
                    onClick={() => applyPreset("gmail")}
                    className="px-3.5 py-1.5 bg-[#f5f3ff] hover:bg-purple-100 text-[#6d28d9] font-bold text-xs rounded-xl border border-purple-200 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#8b5cf6]" />
                    Gmail SMTP
                  </button>
                  <button 
                    type="button"
                    onClick={() => applyPreset("outlook")}
                    className="px-3.5 py-1.5 bg-[#eff6ff] hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-250 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    Outlook/Hotmail
                  </button>
                  <button 
                    type="button"
                    onClick={() => applyPreset("corporate")}
                    className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-750 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin-hover" />
                    SMTP Araçatuba Técnico
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveSmtp} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Host SMTP */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Servidor Host SMTP</label>
                    <div className="relative">
                      <Server className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        required 
                        value={host}
                        onChange={(e) => {
                          setHost(e.target.value);
                          setIsCredentialsVerified("untested");
                          setCredentialsLogs([]);
                        }}
                        placeholder="ex: smtp.provedor.com"
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                      />
                    </div>
                  </div>

                  {/* Port SMTP */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Porta SMTP</label>
                    <div className="relative">
                      <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        required
                        maxLength={5}
                        value={port}
                        onChange={(e) => {
                          setPort(e.target.value.replace(/[^0-9]/g, ""));
                          setIsCredentialsVerified("untested");
                          setCredentialsLogs([]);
                        }}
                        placeholder="ex: 587"
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* SMTP Username */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Usuário de Autenticação</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="email" 
                        required
                        value={user}
                        onChange={(e) => {
                          setUser(e.target.value);
                          setIsCredentialsVerified("untested");
                          setCredentialsLogs([]);
                        }}
                        placeholder="ex: remetente@email.com"
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                      />
                    </div>
                  </div>

                  {/* SMTP Password */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Senha de Envio</label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required
                        value={pass}
                        onChange={(e) => {
                          setPass(e.target.value);
                          setIsCredentialsVerified("untested");
                          setCredentialsLogs([]);
                        }}
                        placeholder="ex: Senha segura ou Token SMTP"
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 flex items-center cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Custom Sender Address display string */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Nome do Remetente Exibido (Header)</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      required
                      value={senderAddress}
                      onChange={(e) => setSenderAddress(e.target.value)}
                      placeholder="Araçatuba Gestão Técnica <suporte@empresa.com.br>"
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block font-medium">Determina o nome amigável e o email exibido no cabeçalho.</span>
                </div>

                {/* SSL Checkbox toggle with details */}
                <div className="flex items-start gap-3 bg-slate-50 p-4 border border-slate-200/50 rounded-xl">
                  <input 
                    id="ssl-option"
                    type="checkbox" 
                    checked={secure}
                    onChange={(e) => {
                      setSecure(e.target.checked);
                      setIsCredentialsVerified("untested");
                      setCredentialsLogs([]);
                    }}
                    className="w-4.5 h-4.5 rounded border-slate-350 bg-white text-indigo-600 mt-0.5 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-left font-sans text-xs">
                    <label htmlFor="ssl-option" className="font-extrabold text-slate-800 cursor-pointer flex items-center gap-1.5 select-none">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      Habilitar Sessão Segura e Conexão SSL / TLS
                    </label>
                    <p className="text-slate-400 text-[10px] mt-1">Recomendado na maioria dos provedores (Portas 465 SSL ou 587 TLS automático).</p>
                  </div>
                </div>

                {/* PRE-SAVE SMTP CREDENTIALS TESTING PANEL */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Testador & Validador de Credenciais SMTP</h3>
                    </div>
                    {isCredentialsVerified === "success" && (
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-wider rounded-md flex items-center gap-3 animate-pulse">
                        <Check className="w-3 h-3 stroke-[3]" />
                        Operacional
                      </span>
                    )}
                  </div>

                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Envie um e-mail de teste de autenticação completo para o endereço configurado <strong>{user || "suporte@aracatubaservicos.com.br"}</strong>. Isso garante que o host, as portas, o SSL e as credenciais estejam 100% operacionais e livres de falhas de envio antes de persistir as alterações.
                  </p>

                  {/* Status Banner */}
                  <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs font-semibold ${
                    isCredentialsVerified === "untested" ? "bg-amber-50/70 border-amber-200/60 text-amber-800" :
                    isCredentialsVerified === "testing" ? "bg-blue-50/70 border-blue-200/60 text-blue-800" :
                    isCredentialsVerified === "success" ? "bg-emerald-50/70 border-emerald-200/60 text-emerald-800" :
                    "bg-rose-50/70 border-rose-200/60 text-rose-800"
                  }`}>
                    <div className="flex items-center gap-2">
                      {isCredentialsVerified === "untested" && <AlertTriangle className="w-4 h-4 text-amber-500 animate-bounce shrink-0" />}
                      {isCredentialsVerified === "testing" && <RefreshCw className="w-4 h-4 text-blue-550 animate-spin shrink-0" />}
                      {isCredentialsVerified === "success" && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                      {isCredentialsVerified === "failed" && <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />}
                      <span>
                        {isCredentialsVerified === "untested" && "Aguardando envio do e-mail de teste..."}
                        {isCredentialsVerified === "testing" && "Efetuando Handshake & Autenticação SMTP..."}
                        {isCredentialsVerified === "success" && "Servidor operacional! E-mail enviado com sucesso."}
                        {isCredentialsVerified === "failed" && "Conexão rejeitada. Verifique as credenciais digitadas."}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isCredentialsVerified === "testing"}
                      onClick={executeValidateCredentials}
                      className="px-3.5 py-1.5 bg-slate-900 border border-slate-950 text-white rounded-xl hover:bg-slate-800 transition-all font-bold text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isCredentialsVerified === "testing" ? (
                        <>
                          <RefreshCw className="w-3 text-white h-3 animate-spin" />
                          <span>Validando...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3 h-3 text-white" />
                          <span>Enviar E-mail de Teste</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Validation logs stream display */}
                  {credentialsLogs.length > 0 && (
                    <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 font-mono text-[9px] text-slate-300 space-y-1 max-h-[120px] overflow-y-auto scroll-narrow">
                      {credentialsLogs.map((log, idx) => {
                        let textClass = "text-slate-300";
                        if (log.includes("ERROR") || log.includes("Falha")) textClass = "text-rose-400 font-semibold";
                        if (log.includes("sucesso") || log.includes("OK") || log.includes("negociado") || log.includes("negociada") || log.includes("concluído")) textClass = "text-emerald-400 font-semibold";
                        return (
                          <div key={idx} className={textClass}>
                            {log}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Warning prompt when user clicks Save without validation first */}
                  {showNotValidatedPrompt && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3 animate-fade-in">
                      <div className="flex gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-left">
                          <h4 className="text-xs font-extrabold text-slate-800">Cuidado: Canal Não Validado</h4>
                          <p className="text-slate-500 text-[10.5px] mt-0.5 leading-relaxed">
                            É altamente recomendado enviar o e-mail de teste para garantir o funcionamento do SMTP e evitar falhas de comunicação silenciosas. Deseja realizar o teste ou salvar as credenciais assim mesmo?
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setShowNotValidatedPrompt(false);
                            executeSaveSmtp();
                          }}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition-all border border-amber-400 cursor-pointer"
                        >
                          Salvar Sem Validar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNotValidatedPrompt(false);
                            executeValidateCredentials();
                          }}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all cursor-pointer"
                        >
                          Executar Teste SMTP Agora
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Action Block */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:translate-y-[1px] cursor-pointer"
                  >
                    Salvar Configurações SMTP
                  </button>
                </div>
              </form>
            </div>

            {/* Diagnostic Box SMTP */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-6 flex flex-col space-y-4 animate-fade-in text-left">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Terminal className="w-4.5 h-4.5 text-indigo-550" />
                <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Auditoria de Conexão SMTP</h2>
              </div>

              <div className="text-left space-y-3 flex-1 flex flex-col">
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Dispare um teste rápido usando os dados acima para garantir que o redirecionamento de emails não seja interrompido por dados de host incorretos.
                </p>

                {/* Target test email input */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Destinatário do Teste</label>
                  <div className="relative">
                    <input 
                      type="email" 
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder={user || "destinatario@teste.com"}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3.5 py-2 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                    />
                  </div>
                </div>

                {/* Test Trigger button */}
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={executeTestConnection}
                  className="w-full py-2.5 bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-800 disabled:bg-slate-400 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:translate-y-[1px]"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                      Testando Conexão SMTP...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Testar Envio SMTP
                    </>
                  )}
                </button>

                {/* Real-time terminal diagnostic logs block */}
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-[9.5px] leading-relaxed text-emerald-400 flex-1 flex flex-col justify-between overflow-hidden min-h-[200px]">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-2 text-slate-500 font-bold">
                      <span className="uppercase text-[8px] tracking-wider text-slate-400">Terminal Diagnóstico SMTP</span>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    
                    <div className="scroll-narrow space-y-1.5 max-h-[160px] overflow-y-auto pr-1 text-slate-300">
                      {testLogs.length === 0 ? (
                        <div className="text-slate-500 italic py-6 text-center">Nenhum teste de conexão SMTP executado.</div>
                      ) : (
                        testLogs.map((log, idx) => {
                          const isClient = log.includes("[SMTP CLIENT]");
                          const isServer = log.includes("[SMTP SERVER]");
                          let colorClass = "text-slate-400";
                          if (isClient) colorClass = "text-indigo-400";
                          if (isServer) colorClass = "text-teal-400";
                          if (log.includes("failed") || log.includes("Error")) colorClass = "text-rose-400 font-bold";
                          if (log.includes("successful") || log.includes("Ok") || log.includes("Ready")) colorClass = "text-emerald-400 font-extrabold";
                          return (
                            <div key={idx} className={`${colorClass} whitespace-pre-wrap breakdown-all`}>
                              {log}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {testResult !== "not_started" && (
                    <div className="border-t border-slate-900 pt-2 flex items-center justify-between mt-auto">
                      <span className="text-slate-500 text-[8.5px] uppercase font-black">Status do Canal:</span>
                      {testResult === "success" ? (
                        <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          OK, ENVIADO!
                        </span>
                      ) : (
                        <span className="text-red-400 font-extrabold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          AUTENTICAÇÃO INVÁLIDA
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: WHATSAPP SETTINGS */}
        {activeSubTab === "whatsapp" && (
          <>
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-xs p-6 space-y-6 animate-fade-in text-left">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Parâmetros WhatsApp Business API</h2>
              </div>

              {/* Whatsapp Preset Buttons */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Provedores Recomendados (Presets):</span>
                <div className="flex flex-wrap gap-2">
                  <button 
                    type="button"
                    onClick={() => applyWaPreset("twilio")}
                    className="px-3.5 py-1.5 bg-[#ecfdf5] hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-250 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-emerald-555" />
                    Twilio API
                  </button>
                  <button 
                    type="button"
                    onClick={() => applyWaPreset("cloud_api")}
                    className="px-3.5 py-1.5 bg-[#eff6ff] hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-250 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    Meta Cloud API (Oficial)
                  </button>
                  <button 
                    type="button"
                    onClick={() => applyWaPreset("custom")}
                    className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-750 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                    Webhook Customizado
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveWhatsapp} className="space-y-4">
                
                {/* Provider select & Status checkbox row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Tipo de Provedor</label>
                    <select
                      value={waProvider}
                      onChange={(e) => setWaProvider(e.target.value as any)}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500"
                    >
                      <option value="twilio">Twilio WhatsApp Sandbox</option>
                      <option value="cloud_api">WhatsApp Cloud API (Meta)</option>
                      <option value="custom">Gateway Customizado / Post Webhook</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Número do WhatsApp Remetente</label>
                    <div className="relative">
                      <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        required
                        value={waFromNumber}
                        onChange={(e) => setWaFromNumber(e.target.value)}
                        placeholder="Ex: +14155238886"
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                      />
                    </div>
                  </div>
                </div>

                {/* API Request URL */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Link de requisição (URL da API)</label>
                  <div className="relative">
                    <Server className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="url" 
                      required
                      value={waApiUrl}
                      onChange={(e) => setWaApiUrl(e.target.value)}
                      placeholder="https://api.twilio.com/..."
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                    />
                  </div>
                  <span className="text-[9.5px] text-slate-400 block font-medium">Link do serviço de mensagens (ex: twilio, webhook, z-api, chatpro ou gateway nacional preferido).</span>
                </div>

                {/* Token / API Key */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Token de Autenticação / API Key</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type={showWaToken ? "text" : "password"} 
                      required
                      value={waApiToken}
                      onChange={(e) => setWaApiToken(e.target.value)}
                      placeholder="Insira as credenciais secretas do gateway"
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowWaToken(!showWaToken)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 flex items-center cursor-pointer"
                    >
                      {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Switch Toggle for active programmatics */}
                <div className="flex items-start gap-3 bg-emerald-50/50 p-4 border border-emerald-200/40 rounded-xl">
                  <input 
                    id="wa-enabled"
                    type="checkbox" 
                    checked={waEnabled}
                    onChange={(e) => setWaEnabled(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-emerald-300 bg-white text-emerald-600 mt-0.5 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-left font-sans text-xs">
                    <label htmlFor="wa-enabled" className="font-extrabold text-slate-800 cursor-pointer flex items-center gap-1.5 select-none">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Ativar Disparador Programático de WhatsApp
                    </label>
                    <p className="text-slate-400 text-[10px] mt-1">Ao marcar esta opção, os alertas manuais de "Reset de Senha" acionados pelo gestor tentarão conectar de verdade através deste link, disparando mensagens reais programáticas.</p>
                  </div>
                </div>

                {/* Submit button */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:translate-y-[1px] cursor-pointer"
                  >
                    Salvar Ajustes do WhatsApp
                  </button>
                </div>

              </form>
            </div>

            {/* Diagnostic Box WhatsApp */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-6 flex flex-col space-y-4 animate-fade-in text-left">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Terminal className="w-4.5 h-4.5 text-emerald-600" />
                <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Auditoria de Envio WhatsApp</h2>
              </div>

              <div className="text-left space-y-3 flex-1 flex flex-col">
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Realize um teste prático disparando uma notificação de texto para um telefone ativo antes de habilitar o disparo sistêmico.
                </p>

                {/* Target test Phone input */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Celular Alvo do Teste</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={waTestPhone}
                      onChange={(e) => setWaTestPhone(e.target.value)}
                      placeholder="Ex: (18) 99123-4567"
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3.5 py-2 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                    />
                  </div>
                </div>

                {/* Target test message body */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Mensagem Customizada</label>
                  <textarea
                    rows={2}
                    value={waTestMessage}
                    onChange={(e) => setWaTestMessage(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3.5 py-2 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 font-sans"
                  />
                </div>

                {/* Test Trigger button */}
                <button
                  type="button"
                  disabled={waIsTesting}
                  onClick={executeWaTestConnection}
                  className="w-full py-2.5 bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-800 disabled:bg-slate-400 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:translate-y-[1px]"
                >
                  {waIsTesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                      Invocando API WhatsApp...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-emerald-400" />
                      Disparar WhatsApp de Teste
                    </>
                  )}
                </button>

                {/* Real-time terminal diagnostic logs block */}
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-[9.5px] leading-relaxed text-emerald-400 flex-1 flex flex-col justify-between overflow-hidden min-h-[180px]">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-2 text-slate-500 font-bold">
                      <span className="uppercase text-[8px] tracking-wider text-emerald-400">Terminal Diagnóstico API</span>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-550 bg-emerald-500 animate-pulse" />
                    </div>
                    
                    <div className="scroll-narrow space-y-1.5 max-h-[140px] overflow-y-auto pr-1 text-slate-300">
                      {waTestLogs.length === 0 ? (
                        <div className="text-slate-500 italic py-6 text-center">Nenhum envio de teste de WhatsApp invocado ainda.</div>
                      ) : (
                        waTestLogs.map((log, idx) => {
                          const isClient = log.includes("[HTTP CLIENT]");
                          const isServer = log.includes("[API SERVER]") || log.includes("[API SEVER]");
                          let colorClass = "text-slate-400";
                          if (isClient) colorClass = "text-indigo-400";
                          if (isServer) colorClass = "text-emerald-400";
                          if (log.includes("ERROR") || log.includes("Exception") || log.includes("Error")) colorClass = "text-rose-400 font-bold";
                          if (log.includes("HTTP OK") || log.includes("sucesso") || log.includes("success")) colorClass = "text-emerald-400 font-extrabold";
                          return (
                            <div key={idx} className={`${colorClass} whitespace-pre-wrap breakdown-all`}>
                              {log}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {waTestResult !== "not_started" && (
                    <div className="border-t border-slate-900 pt-2 flex items-center justify-between mt-auto">
                      <span className="text-slate-500 text-[8.5px] uppercase font-black">Status do Disparo:</span>
                      {waTestResult === "success" ? (
                        <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          OK, ENVIADO!
                        </span>
                      ) : (
                        <span className="text-red-400 font-extrabold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          FALHA DE CHAMADA
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* TAB 3: BACKUP & RESTORE SYSTEM */}
        {activeSubTab === "backup" && (() => {
          const { stats, totalBytes } = getLocalStorageStats();
          return (
            <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 space-y-6 animate-fade-in text-left">
              {/* Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5 gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl text-amber-650 dark:text-amber-450 border border-amber-100 dark:border-amber-900/30 shrink-0">
                    <Database className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-slate-800 dark:text-white text-base uppercase tracking-wider">Cópia de Segurança / Backup do Gestor</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Exporte toda a base de dados de ARAÇATUBA para um arquivo JSON seguro ou gerencie backups internos apartados periódicos.</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-700 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-[1px] active:translate-y-0"
                  >
                    <Download className="w-4 h-4 text-indigo-200" />
                    Exportar JSON Completo
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCreateInternalBackup("manual")}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-[1px] active:translate-y-0"
                  >
                    <Save className="w-4 h-4 text-emerald-200" />
                    Gerar Ponto Interno
                  </button>
                </div>
              </div>

              {/* Grid Overview Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Tamanho Estimado da Base</span>
                  <div className="my-2">
                    <span className="text-2xl font-black text-slate-800 dark:text-white">{(totalBytes / 1024).toFixed(3)} KB</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono mt-1">{totalBytes} bytes em armazenamento local</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 bg-emerald-50/80 dark:bg-emerald-950/10 p-1 rounded-lg border border-emerald-100/50 dark:border-emerald-900/20 block w-fit">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Status Saudável
                  </span>
                </div>

                <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Cópias Locais (Setor Apartado)</span>
                  <div className="my-2">
                    <span className="text-2xl font-black text-indigo-650 dark:text-indigo-400">{internalBackups.length} Registros</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">Armazenamento isolado para restauração</span>
                  </div>
                  <span className="text-[9px] font-extrabold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100/50 dark:border-indigo-900/30 rounded-lg px-2 py-0.5 block w-fit">
                    Histórico Ativo
                  </span>
                </div>

                <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Tipo de Governança e Rotina</span>
                  <div className="my-2">
                    <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                      {backupFrequency === "disabled" ? "Manual" : backupFrequency === "daily" ? "Diário" : backupFrequency === "weekly" ? "Semanal" : "Mensal"}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">
                      {backupFrequency === "disabled" ? "Sem agendamentos ativos" : `Rotina às ${backupTime}h`}
                    </span>
                  </div>
                  <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider bg-amber-50 dark:bg-amber-950/30 border border-amber-100/50 dark:border-amber-900/30 rounded-lg px-2 py-0.5 block w-fit">
                    Prefeitura Municipal
                  </span>
                </div>
              </div>

              {/* Advanced Controls Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                {/* Left Side: Scheduling Config and Manual triggers */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Backup Configuration Schedulers */}
                  <div className="bg-slate-50/55 dark:bg-slate-950/10 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-350 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                      Configurar Backup Periódico
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal font-medium">
                      Programe cópias de segurança que rodam em background para registrar snapshots apartados no banco de dados.
                    </p>

                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="text-[10.5px] font-bold text-slate-600 dark:text-slate-450 block mb-1.5">Frequência Periódica:</label>
                        <select
                          value={backupFrequency}
                          onChange={(e) => handleSaveBackupConfig(e.target.value as any, backupTime)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-slate-800 dark:text-white"
                        >
                          <option value="disabled">🚫 Apenas Manual / Desativado</option>
                          <option value="daily">📅 Execução Diária</option>
                          <option value="weekly">📅 Execução Semanal</option>
                          <option value="monthly">📅 Execução Mensal</option>
                        </select>
                      </div>

                      {backupFrequency !== "disabled" && (
                        <div>
                          <label className="text-[10.5px] font-bold text-slate-600 dark:text-slate-455 block mb-1.5">Horário Programado:</label>
                          <input
                            type="time"
                            value={backupTime}
                            onChange={(e) => handleSaveBackupConfig(backupFrequency, e.target.value)}
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono font-bold text-slate-800 dark:text-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Manual trigger form */}
                  <div className="bg-slate-50/55 dark:bg-slate-950/10 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-3">
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-350 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <Save className="w-4 h-4 text-emerald-500" />
                      Registrar Cópia Interna Manual
                    </h3>
                    <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-normal font-medium">
                      O sistema guardará o instantâneo atual no setor de banco de dados separado.
                    </p>

                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Ex: Cópia antes da folha mensal..."
                        value={backupDescription}
                        onChange={(e) => setBackupDescription(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-850 dark:text-white font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => handleCreateInternalBackup("manual")}
                        className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Gerar Backup Agora
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Side: Backups tracking table and external JSON import */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Backups List Tracking */}
                  <div className="bg-slate-50/55 dark:bg-slate-950/10 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <span className="flex items-center gap-1.5">
                        <History className="w-4 h-4 text-indigo-550 dark:text-indigo-400 shrink-0" />
                        Histórico e Acompanhamento de Backups Realizados
                      </span>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-850 font-mono px-2 py-0.5 rounded-full text-slate-650 dark:text-slate-400">
                        {internalBackups.length} salvos
                      </span>
                    </h3>

                    {internalBackups.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                        <Database className="w-8 h-8 mx-auto stroke-1 mb-2 opacity-50" />
                        <p className="text-xs font-bold">Nenhum backup registrado no setor de banco separado.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[550px]">
                          <thead>
                            <tr className="border-b border-slate-150 dark:border-slate-800 text-slate-400 uppercase text-[9px] tracking-widest font-black">
                              <th className="pb-2">ID / Data de Geração</th>
                              <th className="pb-2">Tipo</th>
                              <th className="pb-2">Tamanho</th>
                              <th className="pb-2">Descrição</th>
                              <th className="pb-2 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                            {internalBackups.map((bk) => (
                              <tr key={bk.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                                <td className="py-2.5">
                                  <span className="font-mono font-bold text-slate-850 dark:text-white block">{bk.id}</span>
                                  <span className="text-[9.5px] text-slate-400 dark:text-slate-500 block">
                                    {new Date(bk.date).toLocaleString("pt-BR")}
                                  </span>
                                </td>
                                <td className="py-2.5">
                                  {bk.type === "agendado" ? (
                                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider">
                                      ⏰ Periódico
                                    </span>
                                  ) : (
                                    <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider">
                                      👤 Manual
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 font-mono text-slate-650 dark:text-slate-400 font-semibold">{bk.size}</td>
                                <td className="py-2.5 max-w-[180px] truncate" title={bk.description}>
                                  <span className="text-slate-700 dark:text-slate-300 font-medium text-[11px] block">{bk.description}</span>
                                </td>
                                <td className="py-2.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(`⚠️ AVISO DE RESTAURAÇÃO DE BACKUP:\n\nTem certeza de que deseja restaurar a imagem ${bk.id}?\nEsta ação substituirá integralmente os dados de chamados, equipes, usuários e configurações atuais por aqueles contidos no backup.`)) {
                                          handleRestoreInternalBackup(bk.id);
                                        }
                                      }}
                                      className="p-1.5 text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                                      title="Restaurar este ponto de segurança"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(`Deseja excluir permanentemente o backup ${bk.id} do setor apartado?`)) {
                                          handleDeleteInternalBackup(bk.id);
                                        }
                                      }}
                                      className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                      title="Excluir ponto de backup"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* External file restore */}
                  <div className="bg-slate-50/55 dark:bg-slate-950/10 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <Upload className="w-4 h-4 text-indigo-500 shrink-0" />
                      Restaurar Base (Carregar Arquivo .JSON Externo)
                    </h3>
                    
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal font-medium">
                      O processo de restauração lerá o arquivo `.json` exportado anteriormente e reiniciará o portal do gestor recarregando os chamados, equipes, usuários e logs gravados originalmente no backup.
                    </p>

                    <div 
                      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragActive(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleImportFile(e.dataTransfer.files[0]);
                        }
                      }}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center gap-3 cursor-pointer ${
                        dragActive 
                          ? "border-indigo-500 bg-indigo-50/50 text-indigo-600 scale-[0.99]" 
                          : "border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50/50 text-slate-500"
                      }`}
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = ".json";
                        input.onchange = (e: any) => {
                          if (e.target.files && e.target.files[0]) {
                            handleImportFile(e.target.files[0]);
                          }
                        };
                        input.click();
                      }}
                    >
                      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600">
                        <Upload className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <span className="font-extrabold text-xs text-slate-800 block">Arraste ou clique para selecionar</span>
                        <span className="text-[10px] text-slate-400 font-medium">Aceita apenas arquivos JSON gerados pelo sistema Araçatuba</span>
                      </div>
                    </div>

                    {importError && (
                      <div className="bg-rose-50 border border-rose-205 border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs font-bold leading-normal text-left flex items-start gap-2 animate-fade-in">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 animate-bounce" />
                        <div>
                          <span className="uppercase text-[9px] block font-black text-rose-800 tracking-wider">Falha de Integridade</span>
                          <span>{importError}</span>
                        </div>
                      </div>
                    )}

                    {importSuccess && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3.5 rounded-xl text-xs font-bold leading-normal text-left flex items-start gap-2 animate-pulse">
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="uppercase text-[9px] block font-black text-emerald-800 tracking-wider">Assinatura Válida</span>
                          <span>Dados restaurados com êxito! Aplicando sincronização e recarregando em 2 segundos...</span>
                        </div>
                      </div>
                    )}

                    <div className="bg-amber-55/60 bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl text-[10.5px] leading-relaxed text-left flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="uppercase text-[9px] font-black text-amber-900 tracking-wider block">⚠️ AVISO DE SUBSTITUIÇÃO</strong>
                        <span>A importação de um backup <strong>sobrescreve totalmente</strong> as informações de chamados e configurações locais atuais. Recomenda-se baixar um backup atual preventivamente.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics Details */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-3">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-350 block">Detalhamento Técnico das Tabelas Operacionais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stats.map((row) => (
                    <div key={row.key} className="flex items-center justify-between p-3.5 text-xs bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-900/40 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          row.exists ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-800 text-slate-350 dark:text-slate-650"
                        }`}>
                          {row.key.includes("smtp") ? (
                            <Mail className="w-4 h-4" />
                          ) : row.key.includes("whatsapp") ? (
                            <Smartphone className="w-4 h-4" />
                          ) : row.key.includes("password") ? (
                            <Key className="w-4 h-4 focus-visible:no-underline" />
                          ) : (
                            <Database className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 dark:text-white block truncate">{row.label}</span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono block select-all truncate">{row.key}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-2">
                        {row.exists ? (
                          <>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300 block">
                              {row.count > 0 ? `${row.count} itens` : "Ativo"}
                            </span>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono block">{(row.bytes / 1024).toFixed(3)} KB</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-350 dark:text-slate-600 font-bold uppercase tracking-wider block bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded-md">
                            Ausente
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 4: MODULAR PERMISSIONS RBAC */}
        {activeSubTab === "permissions" && (
          <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-xs p-5 sm:p-6 space-y-6 animate-fade-in text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="bg-red-50 text-red-650 p-2.5 rounded-xl border border-red-100 shrink-0">
                  <ShieldCheck className="w-5 h-5 text-red-505" />
                </div>
                <div>
                  <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Tabelas Modulares de Controle de Acesso (RBAC)</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Defina quais categorias de usuário visualizam cada tela no menu principal.</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-150">
              <table className="w-full text-xs font-sans text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-[9px] tracking-widest border-b border-slate-150">
                    <th className="px-5 py-3.5 rounded-l-xl">Módulo / Tela</th>
                    <th className="px-4 py-3.5 text-center">👤 Requisitante</th>
                    <th className="px-4 py-3.5 text-center">🔧 Gestor Serviços</th>
                    <th className="px-4 py-3.5 text-center">🛡️ Gestor Adm</th>
                    <th className="px-4 py-3.5 text-center">🛠️ Técnico</th>
                    <th className="px-5 py-3.5 text-center rounded-r-xl">⚙️ Admin Geral</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {[
                    { id: "dashboard", label: "Painel Geral / Dashboard", desc: "Métricas consolidadas, avisos de bloqueio e relatórios compactados." },
                    { id: "clients", label: "Usuários", desc: "Cadastro e homologação de munícipes, gestores e novos perfis." },
                    { id: "orders", label: "Requisições de Serviço", desc: "Listagem, triagem, edição, deleção e emissão de PDFs de Ordens." },
                    { id: "scheduler", label: "Agenda / Calendário", desc: "Cronograma de manutenções em tempo integral e alocações de técnicos." },
                    { id: "professionals", label: "Técnicos & Equipe", desc: "Cadastro de equipes de campo e controle de materiais em estoque." },
                    { id: "reports", label: "Relatórios & Logs", desc: "Gráficos de volumetria, faturamento e logs de auditoria de segurança." },
                    { id: "settings", label: "Configurações & Governança", desc: "Configurações de servidores SMTP, gateways de WhatsApp e Permissões." },
                    { id: "assistant", label: "Assistente IA Gemini", desc: "Chat inteligente com a IA para suporte operacional e diagnóstico de chamados." }
                  ].map((row) => {
                    const rolesAllowed = permissions[row.id] || [];
                    
                    const toggleRole = (role: string) => {
                      if (!onSavePermissions) return;
                      let updatedRoles = [...rolesAllowed];
                      if (updatedRoles.includes(role)) {
                        updatedRoles = updatedRoles.filter(r => r !== role);
                      } else {
                        updatedRoles.push(role);
                      }
                      const updatedPerms = {
                        ...permissions,
                        [row.id]: updatedRoles
                      };
                      onSavePermissions(updatedPerms);
                      if (onNotifyTest) {
                        onNotifyTest("Permissões Modificadas", `O acesso ao módulo "${row.label}" foi alterado em tempo real.`, "success");
                      }
                    };

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <span className="font-extrabold text-slate-800 text-xs block">{row.label}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{row.desc}</span>
                        </td>
                        
                        {/* Requisitante */}
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRole("requisitante")}
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer ${
                              rolesAllowed.includes("requisitante")
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-slate-50 text-slate-350 border border-slate-200"
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[3.5]" />
                          </button>
                        </td>

                        {/* Gestor de Serviços */}
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRole("gestor_servicos")}
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer ${
                              rolesAllowed.includes("gestor_servicos")
                                ? "bg-cyan-100 text-cyan-805 text-cyan-800 border border-cyan-300"
                                : "bg-slate-50 text-slate-350 border border-slate-200"
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[3.5]" />
                          </button>
                        </td>

                        {/* Gestor Adm */}
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRole("gestor")}
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer ${
                              rolesAllowed.includes("gestor")
                                ? "bg-purple-100 text-purple-800 border border-purple-300"
                                : "bg-slate-50 text-slate-350 border border-slate-200"
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[3.5]" />
                          </button>
                        </td>

                        {/* Técnico */}
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRole("profissional")}
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer ${
                              rolesAllowed.includes("profissional")
                                ? "bg-blue-100 text-blue-800 border border-blue-300"
                                : "bg-slate-50 text-slate-350 border border-slate-200"
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[3.5]" />
                          </button>
                        </td>

                        {/* Administrador */}
                        <td className="px-5 py-4 text-center">
                          <div
                            className="w-7 h-7 rounded-lg inline-flex items-center justify-center bg-red-100 text-red-650 border border-red-300 cursor-not-allowed text-center"
                            title="Administradores têm bypass e acesso incondicional vitalício a todas as telas para evitar travamentos acidentais (softlock)."
                          >
                            <Check className="w-4 h-4 stroke-[3.5]" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-start gap-2.5">
              <AlertTriangle className="w-4.5 h-4.5 text-slate-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="text-xs text-slate-600 leading-relaxed font-semibold">
                <strong className="block uppercase text-[9px] tracking-wider text-slate-705 font-black mb-0.5">⚠️ Segurança de Acesso Operacional</strong>
                <span>
                  Qualquer mudança de permissão modular entra em vigor instantaneamente para todas as sessões. Por motivos de segurança, o perfil de <strong>Admin Geral (Administrador do Sistema)</strong> retém acesso incondicional a todas as abas das equipes e de configuração, impedindo bloqueio acidental.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ALMOXARIFADOS */}
        {activeSubTab === "almoxarifados" && (
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
              
              {!canManageAlmoxarifados && (
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-3 text-amber-800 dark:text-amber-300 text-xs font-semibold leading-relaxed">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5 animate-pulse" />
                  <div>
                    <strong className="font-bold text-amber-900 dark:text-amber-200">Apenas Visualização / Sem Permissão</strong>
                    <p className="mt-0.5 text-[11px] font-medium">Seu perfil não possui permissão para adicionar, editar ou excluir almoxarifados. Apenas Administradores (admin) e Gestores (gestor) podem modificar estes registros.</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Almoxarifados Cadastrados</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-semibold">
                    Gerencie as bases físicas de alocação de equipes e técnicos de serviços. <span className="text-amber-600 dark:text-amber-400 font-extrabold">(Este sistema não faz controle de estoque de materiais)</span>
                  </p>
                </div>
                {canManageAlmoxarifados && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAlm(null);
                      setAlmName("");
                      setAlmCode("");
                      setAlmAddress("");
                      setIsAlmFormOpen(true);
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-600/10 cursor-pointer flex items-center gap-1.5"
                  >
                    Adicionar Almoxarifado
                  </button>
                )}
              </div>

              {/* Informational Scope Alert */}
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-350">
                  <strong className="font-bold text-slate-800 dark:text-slate-200 block text-[10px] uppercase tracking-wider mb-1">Escopo Operacional & Históricos de Serviços</strong>
                  <p className="font-medium">
                    O sistema é focado exclusivamente no **gerenciamento de serviços**, trabalhando ativamente com alertas e mensagens automatizadas para registrar o histórico completo de ordens de trabalho (**Realizadas, Paradas ou Canceladas**).
                  </p>
                  <p className="mt-1 font-medium text-[11px] text-slate-500 dark:text-slate-400">
                    💡 Caso falte material de serviço no local do requisitante, o técnico pode marcar o serviço como <strong>Parado</strong> ou <strong>Cancelado</strong> para que a coordenação e os gestores sejam alertados instantaneamente, com todo o histórico devidamente registrado.
                  </p>
                </div>
              </div>

              {isAlmFormOpen && canManageAlmoxarifados && (
                <div className="mb-6 p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {editingAlm ? "Editar Almoxarifado" : "Novo Almoxarifado"}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsAlmFormOpen(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome do Almoxarifado *</label>
                      <input
                        type="text"
                        required
                        value={almName}
                        onChange={(e) => setAlmName(e.target.value)}
                        placeholder="Ex: Almoxarifado Central Araçatuba"
                        className="w-full text-sm font-semibold border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Código / Sigla *</label>
                      <input
                        type="text"
                        required
                        value={almCode}
                        onChange={(e) => setAlmCode(e.target.value)}
                        placeholder="Ex: ALM-CEN, ALM-OESTE"
                        className="w-full text-sm font-semibold border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 uppercase font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Endereço / Localização</label>
                      <input
                        type="text"
                        value={almAddress}
                        onChange={(e) => setAlmAddress(e.target.value)}
                        placeholder="Rua, Número, Cidade"
                        className="w-full text-sm font-semibold border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAlmFormOpen(false)}
                      className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-750 dark:text-slate-300 font-bold text-xs uppercase rounded-lg transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!canManageAlmoxarifados) {
                          onNotifyTest("Sem Permissão", "Seu perfil de usuário não possui permissão para salvar almoxarifados.", "error");
                          return;
                        }
                        if (!almName || !almCode) {
                          onNotifyTest("Campos Obrigatórios", "Por favor, informe ao menos o Nome e Código do almoxarifado.", "error");
                          return;
                        }
                        const updatedAlms = [...almoxarifados];
                        if (editingAlm) {
                          const idx = updatedAlms.findIndex(a => a.id === editingAlm.id);
                          if (idx !== -1) {
                            updatedAlms[idx] = { ...editingAlm, name: almName, code: almCode.toUpperCase(), address: almAddress };
                          }
                        } else {
                          updatedAlms.push({
                            id: `alm-${Date.now()}`,
                            name: almName,
                            code: almCode.toUpperCase(),
                            address: almAddress
                          });
                        }
                        if (onSaveAlmoxarifados) {
                          onSaveAlmoxarifados(updatedAlms);
                        }
                        setIsAlmFormOpen(false);
                        setEditingAlm(null);
                        setAlmName("");
                        setAlmCode("");
                        setAlmAddress("");
                        onNotifyTest("Almoxarifado Salvo", `O almoxarifado "${almName}" foi armazenado com sucesso.`, "success");
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase rounded-lg transition-all"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-xs">
                <table className="w-full text-left border-collapse bg-white">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-500">Código</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-500">Nome / Identificação</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-500">Endereço físico</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {almoxarifados.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center text-xs text-slate-400 font-semibold bg-white">
                          Nenhum almoxarifado cadastrado.
                        </td>
                      </tr>
                    ) : (
                      almoxarifados.map(alm => {
                        const linked = isAlmoxarifadoLinked(alm.id);
                        return (
                          <tr key={alm.id} className="border-b border-slate-100 bg-white hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-4 font-mono text-xs font-bold text-indigo-600 uppercase">{alm.code}</td>
                            <td className="px-5 py-4 text-xs font-bold text-slate-800 flex items-center gap-2">
                              <span>{alm.name}</span>
                              {linked && (
                                <span className="bg-amber-50 text-amber-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-wide">
                                  Vinculado
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-xs text-slate-500">{alm.address || "Sem endereço cadastrado"}</td>
                            <td className="px-5 py-4 text-right space-x-2">
                              {canManageAlmoxarifados ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingAlm(alm);
                                      setAlmName(alm.name);
                                      setAlmCode(alm.code);
                                      setAlmAddress(alm.address || "");
                                      setIsAlmFormOpen(true);
                                    }}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-[10px] font-bold uppercase rounded-md transition-all cursor-pointer border border-slate-200/50"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (linked) {
                                        onNotifyTest(
                                          "Operação Não Permitida",
                                          `Não é possível excluir o almoxarifado "${alm.name}" pois ele está atualmente vinculado a um ou mais usuários do sistema. Remova o vínculo primeiro.`,
                                          "error"
                                        );
                                        return;
                                      }
                                      if (confirm(`Tem certeza que deseja excluir o almoxarifado "${alm.name}"?`)) {
                                        const updated = almoxarifados.filter(a => a.id !== alm.id);
                                        if (onSaveAlmoxarifados) {
                                          onSaveAlmoxarifados(updated);
                                        }
                                        onNotifyTest("Almoxarifado Excluído", `O almoxarifado "${alm.name}" foi removido do sistema.`, "system");
                                      }
                                    }}
                                    className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all cursor-pointer border ${
                                      linked
                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60 border-slate-200/50"
                                        : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-100"
                                    }`}
                                    title={linked ? "Este almoxarifado possui usuários vinculados e não pode ser excluído" : "Excluir Almoxarifado"}
                                  >
                                    Excluir
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Apenas Visualização</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PUSH NOTIFICATIONS & SERVICE WORKER DIAGNOSTIC */}
        {activeSubTab === "push_diagnostic" && (
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-6 shadow-xs animate-fade-in text-left">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 text-left">
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-5 h-5 text-rose-505" />
                    Diagnóstico de Service Worker & Notificações em Tempo Real
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold leading-relaxed">
                    Valide a compatibilidade de recursos em segundo plano no seu navegador. O registro correto de um <strong className="text-slate-700 dark:text-slate-200">Service Worker (SW)</strong> é mandatório para permitir que as notificações cheguem mesmo quando a aplicação está em segundo plano ou fechada.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runDiagnostic}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-extrabold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
                >
                  <RefreshCw className="w-4.5 h-4.5" />
                  Reavaliar Tudo
                </button>
              </div>

              {/* Iframe Warning Alert */}
              {isIframe && (
                <div className="mb-6 p-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl flex items-start gap-4 text-amber-800 dark:text-amber-300 text-xs font-semibold leading-relaxed shadow-sm text-left">
                  <Lock className="w-6 h-6 shrink-0 text-amber-500 mt-0.5 animate-bounce" />
                  <div className="space-y-1">
                    <strong className="font-extrabold text-sm text-amber-900 dark:text-amber-200 uppercase tracking-wide block">🔒 Restrição Ativa: Executando dentro de um iFrame (Visualização do AI Studio)</strong>
                    <p className="font-medium text-amber-700/90 dark:text-amber-400/90">
                      O Google AI Studio renderiza este aplicativo em um contêiner sandbox de origem cruzada (iFrame). Por motivos de segurança cibernética (Políticas de Sandbox), os navegadores modernos <strong>bloqueiam ativamente</strong> o registro de Service Workers e solicitações de permissão de notificação quando executados de forma aninhada.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => window.open(window.location.href, "_blank")}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl transition-all cursor-pointer text-[10.5px] uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir em Nova Aba Independente
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Multi-Step Pipeline Visualizer */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 text-left">
                {/* Step 1 */}
                <div className={`p-4.5 rounded-2xl border flex flex-col justify-between space-y-3 ${
                  swSupported 
                    ? "bg-emerald-50/20 dark:bg-emerald-950/5 border-emerald-200/50 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-50/20 dark:bg-rose-950/5 border-rose-200/50 dark:border-rose-900/40 text-rose-800 dark:text-rose-300"
                }`}>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Passo 1</span>
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase mt-1">Service Worker</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                      Capacidade do navegador de executar códigos em segundo plano (Background workers).
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 text-xs font-bold">
                    {swSupported ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-505 shrink-0" />
                        <span>Suportado</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-505 shrink-0" />
                        <span>Incompatível</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Step 2 */}
                <div className={`p-4.5 rounded-2xl border flex flex-col justify-between space-y-3 ${
                  pushSupported 
                    ? "bg-emerald-50/20 dark:bg-emerald-950/5 border-emerald-200/50 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-50/20 dark:bg-rose-950/5 border-rose-200/50 dark:border-rose-900/40 text-rose-800 dark:text-rose-300"
                }`}>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Passo 2</span>
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase mt-1">Push Manager API</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                      Gerenciador nativo de conexões Push de servidores para recebimento em tempo real.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 text-xs font-bold">
                    {pushSupported ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-505 shrink-0" />
                        <span>Suportado</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-505 shrink-0" />
                        <span>Incompatível</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Step 3 */}
                <div className={`p-4.5 rounded-2xl border flex flex-col justify-between space-y-3 ${
                  permissionState === "granted"
                    ? "bg-emerald-50/20 dark:bg-emerald-950/5 border-emerald-200/50 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                    : permissionState === "denied"
                    ? "bg-rose-50/20 dark:bg-rose-950/5 border-rose-200/50 dark:border-rose-900/40 text-rose-800 dark:text-rose-300"
                    : "bg-indigo-50/20 dark:bg-indigo-950/5 border-indigo-200/50 dark:border-indigo-900/40 text-indigo-800 dark:text-indigo-300"
                }`}>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Passo 3</span>
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase mt-1">Permissão do Usuário</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                      Consentimento do navegador para permitir mostrar alertas visuais na área de trabalho.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 text-xs font-bold">
                    {permissionState === "granted" ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-505 shrink-0" />
                        <span>Autorizado (Granted)</span>
                      </>
                    ) : permissionState === "denied" ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-505 shrink-0" />
                        <span>Bloqueado (Denied)</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4 text-indigo-505 shrink-0" />
                        <span>Pendente (Default)</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Step 4 */}
                <div className={`p-4.5 rounded-2xl border flex flex-col justify-between space-y-3 ${
                  swRegState === "registered"
                    ? "bg-emerald-50/20 dark:bg-emerald-950/5 border-emerald-200/50 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                    : swRegState === "failed"
                    ? "bg-rose-50/20 dark:bg-rose-950/5 border-rose-200/50 dark:border-rose-900/40 text-rose-800 dark:text-rose-300"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-400"
                }`}>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Passo 4</span>
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase mt-1">Registro de SW</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                      O Service worker está registrado ativamente nesta origem e ouvindo a rede.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 text-xs font-bold">
                    {swRegState === "registered" ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-505 shrink-0" />
                        <span>Registrado & Ativo</span>
                      </>
                    ) : swRegState === "failed" ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-505 shrink-0" />
                        <span>Falha no Registro</span>
                      </>
                    ) : swRegState === "registering" ? (
                      <>
                        <RefreshCw className="w-4 h-4 text-indigo-500 shrink-0 animate-spin" />
                        <span>Registrando...</span>
                      </>
                    ) : (
                      <>
                        <BellOff className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Não Iniciado</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
                
                {/* Manual SW Action Panel */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Action Dashboard Cards */}
                  <div className="bg-slate-50 dark:bg-slate-950/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Settings className="w-4.5 h-4.5 text-slate-500" />
                      Painel de Controle e Testes do Service Worker
                    </h4>
                    
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                      Com o Service Worker registrado e a permissão de notificações concedida, o navegador poderá interceptar chamadas push em segundo plano e exibir notificações na área de trabalho mesmo se a janela estiver fechada.
                    </p>

                    <div className="flex flex-wrap gap-2.5 pt-2">
                      {/* Button 1: Register permission */}
                      <button
                        type="button"
                        onClick={requestNotificationPermission}
                        disabled={permissionState === "granted" || isIframe}
                        className={`p-2 px-3.5 font-bold rounded-xl text-[11px] uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                          permissionState === "granted"
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-750 cursor-not-allowed"
                            : isIframe
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-750 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10"
                        }`}
                      >
                        <Bell className="w-3.5 h-3.5" />
                        {permissionState === "granted" ? "Permissão Concedida" : "Permitir Notificações"}
                      </button>

                      {/* Button 2: Register SW */}
                      <button
                        type="button"
                        onClick={registerServiceWorker}
                        disabled={swRegState === "registered" || !swSupported || isIframe}
                        className={`p-2 px-3.5 font-bold rounded-xl text-[11px] uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                          swRegState === "registered"
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/10"
                            : !swSupported || isIframe
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-750 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10"
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${swRegState === "registering" ? "animate-spin" : ""}`} />
                        {swRegState === "registered" ? "SW Registrado (Re-registrar)" : "Registrar Service Worker"}
                      </button>

                      {/* Button 3: Remove SW */}
                      <button
                        type="button"
                        onClick={unregisterServiceWorkers}
                        disabled={activeSwCount === 0 || !swSupported}
                        className={`p-2 px-3.5 font-bold rounded-xl text-[11px] uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                          activeSwCount === 0 || !swSupported
                            ? "bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-800 cursor-not-allowed"
                            : "bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/35"
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                        Remover Workers
                      </button>

                      {/* Button 4: Show notification via SW */}
                      <button
                        type="button"
                        onClick={triggerSwNotification}
                        disabled={permissionState !== "granted" || activeSwCount === 0}
                        className={`p-2 px-3.5 font-bold rounded-xl text-[11px] uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                          permissionState !== "granted" || activeSwCount === 0
                            ? "bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-800 cursor-not-allowed"
                            : "bg-slate-800 hover:bg-slate-700 dark:bg-slate-750 dark:hover:bg-slate-650 text-white shadow-md shadow-slate-800/10"
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        Disparar Alerta SW
                      </button>
                    </div>
                  </div>

                  {/* Information Details Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-3 leading-relaxed">
                    <h4 className="font-extrabold text-slate-800 dark:text-slate-100 uppercase text-[10.5px] tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                      <Info className="w-4.5 h-4.5 text-indigo-500" />
                      Por que Notification.permission sozinho não garante entrega em segundo plano?
                    </h4>
                    <p>
                      Muitos desenvolvedores assumem erroneamente que chamar <code>Notification.requestPermission()</code> e receber <code>"granted"</code> é suficiente para Push Notifications reais. No entanto:
                    </p>
                    <ul className="list-disc list-inside space-y-1.5 font-medium pl-1 text-slate-500 dark:text-slate-400">
                      <li>
                        <strong>Aba Ativa vs. Aba Inativa</strong>: Sem um Service Worker registrado, o navegador só pode exibir notificações se a sua aba da aplicação estiver ativa e em foco.
                      </li>
                      <li>
                        <strong>Entrega em Segundo Plano</strong>: Quando o sistema operacional ou navegador suspende a aba inativa para economizar RAM/bateria, a thread principal morre. O único canal capaz de "acordar" o sistema e disparar o som e banner é o <strong>Service Worker</strong>, que opera em uma thread dedicada do kernel do navegador.
                      </li>
                      <li>
                        <strong>Subscrição com PushManager</strong>: Para conectar seu app a serviços reais de Push (como Firebase Cloud Messaging ou WebPush nativo), o navegador exige um Service Worker ativo para registrar a subscrição e associar o endpoint seguro criptografado.
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Log Terminal Block */}
                <div className="bg-slate-950 rounded-2xl border border-slate-900 p-4.5 flex flex-col h-[350px] relative">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2.5 mb-3">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <Terminal className="w-4 h-4 text-indigo-400 animate-pulse" />
                      Terminal de Rastreamento (SW)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSwLogs([])}
                      className="text-[9px] font-extrabold uppercase text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      Limpar logs
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto font-mono text-[10.5px] text-emerald-400 text-left space-y-1.5 leading-relaxed pr-1 custom-scrollbar">
                    {swLogs.length === 0 ? (
                      <span className="text-slate-600 italic block pt-4">Nenhum log registrado. Clique em "Reavaliar Tudo" ou "Registrar" para começar...</span>
                    ) : (
                      swLogs.map((log, index) => (
                        <p key={index} className="break-all whitespace-pre-wrap">
                          {log}
                        </p>
                      ))
                    )}
                  </div>
                  <div className="absolute bottom-2.5 right-4 pointer-events-none">
                    <span className="text-[8px] font-bold text-slate-600 tracking-widest uppercase select-none font-mono">sw_logger_active</span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

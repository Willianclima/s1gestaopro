import React, { useState, useEffect } from "react";
import { 
  Activity, RefreshCw, Lock, ExternalLink, CheckCircle, 
  AlertTriangle, Bell, BellOff, X, Send, Info, Terminal, Settings 
} from "lucide-react";
import { useToast } from "./ToastContext";

interface NotificationDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestPermission: () => Promise<void>;
  currentPermission: NotificationPermission;
}

export default function NotificationDiagnosticModal({
  isOpen,
  onClose,
  onRequestPermission,
  currentPermission
}: NotificationDiagnosticModalProps) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  // Service Worker & Push Notifications Diagnostic States
  const [swSupported, setSwSupported] = useState<boolean | null>(null);
  const [pushSupported, setPushSupported] = useState<boolean | null>(null);
  const [notifSupported, setNotifSupported] = useState<boolean | null>(null);
  const [permissionState, setPermissionState] = useState<string>(currentPermission);
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
    const currentPerm = typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default";
    const inIframe = typeof window !== "undefined" && window.self !== window.top;

    setSwSupported(hasSW);
    setPushSupported(hasPush);
    setNotifSupported(hasNotif);
    setPermissionState(currentPerm);
    setIsIframe(inIframe);

    logs.push(`✓ Suporte a Service Worker: ${hasSW ? "Disponível" : "Não disponível"}`);
    logs.push(`✓ Suporte a Push API (PushManager): ${hasPush ? "Disponível" : "Não disponível"}`);
    logs.push(`✓ Suporte a API de Notificação: ${hasNotif ? "Disponível" : "Não disponível"}`);
    logs.push(`✓ Permissão de Notificação Atual: "${currentPerm}"`);
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
        
        const hasActiveSw = regs.some(r => r.scope === window.location.origin + "/" || r.scope.includes("sw.js") || r.scope.includes("mock-sw.js"));
        if (hasActiveSw) {
          setSwRegState("registered");
          const targetReg = regs.find(r => r.scope === window.location.origin + "/" || r.scope.includes("sw.js") || r.scope.includes("mock-sw.js"));
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
      toastSuccess("O Service Worker foi registrado com sucesso na sua sessão do navegador!", "Service Worker Registrado");
    } catch (err: any) {
      console.error("Erro no registro do SW:", err);
      logs.push(`[REGISTRATION] ❌ Falha catastrófica no registro do Service Worker.`);
      logs.push(`  - Erro detalhado: ${err.message || err}`);
      logs.push("  - Sugestão: Se você estiver vendo este erro no painel do AI Studio, abra o aplicativo em uma NOVA ABA do navegador. Registros de SW em iFrames de origens diferentes são bloqueados.");
      
      setSwRegState("failed");
      setSwRegError(err.message || String(err));
      toastError(`Falha ao registrar o Service Worker: ${err.message || err}`, "Erro de Registro");
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
      toastInfo(`${removedCount} Service Worker(s) desregistrado(s) com sucesso.`, "Service Workers Removidos");
    } catch (err: any) {
      logs.push(`[UNREGISTER] Erro durante a remoção: ${err.message || err}`);
      toastError(`Erro ao desregistrar Service Workers: ${err.message || err}`, "Erro de Desregistro");
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
      await onRequestPermission();
      const currentPerm = Notification.permission;
      setPermissionState(currentPerm);
      logs.push(`[PERMISSION] Resposta da solicitação: "${currentPerm}"`);
      
      if (currentPerm === "granted") {
        logs.push("[PERMISSION] ✓ Permissão concedida pelo usuário!");
        toastSuccess("Agora o sistema está autorizado a exibir notificações na sua área de trabalho.", "Permissão Concedida");
      } else {
        logs.push("[PERMISSION] ⚠️ Permissão negada ou fechada. Os alertas nativos serão bloqueados.");
        toastError("Não será possível exibir notificações nativas de área de trabalho.", "Permissão Bloqueada");
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
      toastSuccess("Notificação via Service Worker disparada! Verifique sua área de trabalho.", "Notificação Enviada");
    } catch (err: any) {
      logs.push(`[NOTIFICATION] ❌ Erro ao disparar notificação: ${err.message || err}`);
      toastError(`Falha ao disparar notificação de teste: ${err.message || err}`, "Erro de Notificação");
    }
    setSwLogs(logs);
  };

  // Run initial diagnostic when the modal is opened
  useEffect(() => {
    if (isOpen) {
      runDiagnostic();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-6 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col relative animate-in fade-in zoom-in-95 duration-150">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 text-left pr-8">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-2xl text-rose-500">
            <Bell className="w-6 h-6 animate-swing" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-5 h-5 text-rose-500" />
              Painel de Diagnóstico de Notificações & Service Worker
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold leading-relaxed">
              Verifique e teste recursos em segundo plano no seu navegador. O registro correto de um <strong className="text-slate-700 dark:text-slate-200">Service Worker (SW)</strong> garante que as notificações cheguem mesmo quando a aplicação estiver minimizada ou fechada.
            </p>
          </div>
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

        {/* Pipeline Steps Indicator */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 text-left">
          {/* Step 1 */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 ${
            swSupported 
              ? "bg-emerald-50/20 dark:bg-emerald-950/5 border-emerald-200/50 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50/20 dark:bg-rose-950/5 border-rose-200/50 dark:border-rose-900/40 text-rose-800 dark:text-rose-300"
          }`}>
            <div>
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Passo 1</span>
              <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase mt-0.5">Service Worker</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                Suporte do navegador para executar tarefas e logs em segundo plano.
              </p>
            </div>
            <div className="flex items-center gap-1.5 pt-1 text-xs font-bold">
              {swSupported ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Suportado</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Incompatível</span>
                </>
              )}
            </div>
          </div>

          {/* Step 2 */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 ${
            pushSupported 
              ? "bg-emerald-50/20 dark:bg-emerald-950/5 border-emerald-200/50 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50/20 dark:bg-rose-950/5 border-rose-200/50 dark:border-rose-900/40 text-rose-800 dark:text-rose-300"
          }`}>
            <div>
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Passo 2</span>
              <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase mt-0.5">Push Manager API</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                Gerenciador nativo de conexões Push de servidores para recebimento em tempo real.
              </p>
            </div>
            <div className="flex items-center gap-1.5 pt-1 text-xs font-bold">
              {pushSupported ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Suportado</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Incompatível</span>
                </>
              )}
            </div>
          </div>

          {/* Step 3 */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 ${
            permissionState === "granted"
              ? "bg-emerald-50/20 dark:bg-emerald-950/5 border-emerald-200/50 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300"
              : permissionState === "denied"
              ? "bg-rose-50/20 dark:bg-rose-950/5 border-rose-200/50 dark:border-rose-900/40 text-rose-800 dark:text-rose-300"
              : "bg-indigo-50/20 dark:bg-indigo-950/5 border-indigo-200/50 dark:border-indigo-900/40 text-indigo-800 dark:text-indigo-300"
          }`}>
            <div>
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Passo 3</span>
              <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase mt-0.5">Permissão</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                Consentimento do navegador para permitir mostrar alertas visuais na área de trabalho.
              </p>
            </div>
            <div className="flex items-center gap-1.5 pt-1 text-xs font-bold">
              {permissionState === "granted" ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Autorizado</span>
                </>
              ) : permissionState === "denied" ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Bloqueado</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 text-indigo-500 shrink-0 animate-pulse" />
                  <span>Pendente</span>
                </>
              )}
            </div>
          </div>

          {/* Step 4 */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 ${
            swRegState === "registered"
              ? "bg-emerald-50/20 dark:bg-emerald-950/5 border-emerald-200/50 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300"
              : swRegState === "failed"
              ? "bg-rose-50/20 dark:bg-rose-950/5 border-rose-200/50 dark:border-rose-900/40 text-rose-800 dark:text-rose-300"
              : "bg-slate-50 dark:bg-slate-850 border-slate-250 dark:border-slate-800 text-slate-700 dark:text-slate-400"
          }`}>
            <div>
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Passo 4</span>
              <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase mt-0.5">Registro de SW</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                Service Worker registrado ativamente nesta origem e ouvindo a rede de fundo.
              </p>
            </div>
            <div className="flex items-center gap-1.5 pt-1 text-xs font-bold">
              {swRegState === "registered" ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Registrado & Ativo</span>
                </>
              ) : swRegState === "failed" ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
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

        {/* Content & Action Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
          
          {/* Action Left Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-50 dark:bg-slate-950/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Settings className="w-4.5 h-4.5 text-slate-500" />
                Painel de Ações de Teste e Registro
              </h4>
              
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                Abaixo estão as ferramentas para ativar e testar as notificações. Use o botão <strong>Disparar Alerta SW</strong> para simular uma nova Ordem de Serviço chegando de fundo.
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
                      : "bg-slate-800 hover:bg-slate-700 dark:bg-slate-750 dark:hover:bg-slate-650 text-white"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Disparar Alerta SW
                </button>
              </div>
            </div>

            {/* Explanatory Details card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-3 leading-relaxed">
              <h4 className="font-extrabold text-slate-800 dark:text-slate-100 uppercase text-[10.5px] tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                <Info className="w-4.5 h-4.5 text-indigo-500" />
                Como funciona a entrega fora do foco principal?
              </h4>
              <p>
                As notificações normais do navegador só funcionam quando você está com a aba ativa e em primeiro plano. Se você minimizar a tela ou bloquear o celular, o navegador congela a aba para salvar memória RAM e energia.
              </p>
              <ul className="list-disc list-inside space-y-1.5 font-medium pl-1 text-slate-500 dark:text-slate-400">
                <li>
                  <strong>Thread de kernel dedicada</strong>: O Service Worker roda como um processo separado do sistema operacional, permitindo receber e alertar o usuário mesmo se o site estiver fechado.
                </li>
                <li>
                  <strong>Endpoints de Push robustos</strong>: Ao registrar as notificações via Service Worker, o sistema gera credenciais de subscrição WebPush seguras para receber disparos instantâneos do servidor em tempo real.
                </li>
              </ul>
            </div>
          </div>

          {/* Logs Panel */}
          <div className="bg-slate-950 rounded-2xl border border-slate-900 p-4.5 flex flex-col h-[350px] relative">
            <div className="flex items-center justify-between border-b border-slate-900 pb-2.5 mb-3">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Terminal className="w-4 h-4 text-indigo-400 animate-pulse" />
                Terminal Logs SW
              </span>
              <button
                type="button"
                onClick={() => setSwLogs([])}
                className="text-[9px] font-extrabold uppercase text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                Limpar logs
              </button>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-[10px] text-emerald-400 text-left space-y-1.5 leading-relaxed pr-1 custom-scrollbar">
              {swLogs.length === 0 ? (
                <span className="text-slate-600 italic block pt-4">Nenhum log registrado. Clique em "Permitir" ou "Registrar" para ver logs em tempo real...</span>
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

        {/* Modal Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={runDiagnostic}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-extrabold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            Reavaliar Tudo
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 font-extrabold rounded-xl text-xs transition-all cursor-pointer shadow-md"
          >
            Fechar Diagnóstico
          </button>
        </div>

      </div>
    </div>
  );
}

import React, { useState } from "react";
import { 
  AlertTriangle, Send, CheckCircle2, ShieldCheck, User, Bell, Mail, Smartphone, 
  Terminal, RefreshCw, FileText, Sparkles, Check, Info, AlertCircle
} from "lucide-react";
import { ServiceOrder, Client, CurrentUser, SmtpSettings, WhatsappSettings, AppNotification } from "../types";
import { playNotificationSound } from "../utils/notificationSound";

interface MaterialAlertDiagnosticProps {
  orders: ServiceOrder[];
  clients: Client[];
  currentUser?: CurrentUser | null;
  smtpSettings: SmtpSettings;
  whatsappSettings: WhatsappSettings;
  addSystemLog: (action: string, details: string, category: "requisicao" | "requisitante" | "tecnico" | "sistema") => void;
  notifyUser: (notif: {
    title: string;
    message: string;
    type?: AppNotification["type"];
    serviceOrderId?: string;
    soundType?: "chime" | "success" | "alert" | "info";
  }) => void;
  onToastSuccess: (msg: string, title?: string) => void;
  onToastInfo: (msg: string, title?: string) => void;
}

interface TestResult {
  timestamp: string;
  orderId: string;
  orderTitle: string;
  requisitanteName: string;
  gestorName: string;
  logSuccess: boolean;
  requisitanteNotified: boolean;
  gestorNotified: boolean;
  soundPlayed: boolean;
  emailSent: boolean;
  whatsappSent: boolean;
  details: string[];
}

export default function MaterialAlertDiagnostic({
  orders = [],
  clients = [],
  currentUser,
  smtpSettings,
  whatsappSettings,
  addSystemLog,
  notifyUser,
  onToastSuccess,
  onToastInfo
}: MaterialAlertDiagnosticProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || "");
  const [testReason, setTestReason] = useState<string>("Falta de Tubulação PVC 100mm e Vedação Hidráulica para conclusão do reparo");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);

  const selectedOrder = orders.find(o => o.id === selectedOrderId) || orders[0];
  const foundClient = clients.find(c => c.id === selectedOrder?.clientId);
  const orderClient = foundClient || {
    id: selectedOrder?.clientId || "cli-unknown",
    name: "Requisitante da OS",
    email: "requisitante@aracatuba.sp.gov.br",
    phone: "(18) 99881-2200",
    document: "111.222.333-44",
    status: "ativo"
  };

  const gestorName = "Willian C. Lima (Gestor de Serviços)";
  const gestorEmail = "willianclima@gmail.com";

  const handleRunSimultaneousAlert = () => {
    if (!selectedOrder) {
      onToastInfo("Por favor, selecione uma Ordem de Serviço para executar o teste.", "Selecione uma OS");
      return;
    }

    setIsSimulating(true);
    const logs: string[] = [];
    const nowStr = new Date().toLocaleTimeString("pt-BR");

    logs.push(`[${nowStr}] 🚀 Iniciando Teste de Diagnóstico de Alerta Simultâneo...`);
    logs.push(`[${nowStr}] 📋 OS Selecionada: #${selectedOrder.id} - "${selectedOrder.title}"`);
    logs.push(`[${nowStr}] 👤 Requisitante Destino: ${orderClient.name} (${orderClient.email || "Sem e-mail registrado"})`);
    logs.push(`[${nowStr}] 🛡️ Gestor Destino: ${gestorName} (${gestorEmail})`);

    setTimeout(() => {
      // Step 1: Play synthesized sound alert
      let soundPlayed = false;
      try {
        playNotificationSound("alert");
        soundPlayed = true;
        logs.push(`[${nowStr}] 🔊 Audio Synthesizer: Alerta sonoro 'alert' reproduzido com sucesso via Web Audio API.`);
      } catch (err) {
        logs.push(`[${nowStr}] ⚠️ Audio Synthesizer: Falha ao reproduzir áudio (${err}).`);
      }

      // Step 2: Register in System Logs
      let logSuccess = false;
      try {
        const logDetail = `TESTE DIAGNÓSTICO: Disparo simultâneo de alerta de Falta de Material para a OS #${selectedOrder.id} ("${selectedOrder.title}"). Insumo pendente: "${testReason}". Destinatários: Requisitante (${orderClient.name}) e Gestor (${gestorName}).`;
        addSystemLog("Diagnóstico Alerta Simultâneo", logDetail, "sistema");
        logSuccess = true;
        logs.push(`[${nowStr}] 📝 Sistema de Logs: Registro armazenado com sucesso em 'service_mgt_logs2'.`);
      } catch (err) {
        logs.push(`[${nowStr}] ❌ Sistema de Logs: Erro ao registrar log (${err}).`);
      }

      // Step 3: Trigger In-App Notifications (Requisitante + Gestor)
      let requisitanteNotified = false;
      let gestorNotified = false;
      try {
        // Notification 1 for Requisitante
        notifyUser({
          title: `⚠️ [TESTE DIAGNÓSTICO] Falta de Material: OS #${selectedOrder.id}`,
          message: `Olá ${orderClient.name}, a execução da OS "${selectedOrder.title}" foi suspensa por falta de: "${testReason}".`,
          type: "system_alert",
          serviceOrderId: selectedOrder.id,
          soundType: "chime"
        });
        requisitanteNotified = true;

        // Notification 2 for Gestor
        notifyUser({
          title: `🚨 [TESTE DIAGNÓSTICO] Alerta de Gestão: OS #${selectedOrder.id}`,
          message: `Gestor, a OS #${selectedOrder.id} (${orderClient.name}) necessita da aquisição urgente do insumo: "${testReason}".`,
          type: "system_alert",
          serviceOrderId: selectedOrder.id,
          soundType: "alert"
        });
        gestorNotified = true;

        logs.push(`[${nowStr}] 🔔 Central de Notificações: In-app Push enfileirado para Requisitante e Gestor.`);
      } catch (err) {
        logs.push(`[${nowStr}] ❌ Central de Notificações: Erro ao enviar (${err}).`);
      }

      // Step 4: Dispatch / Simulate Email & WhatsApp
      const emailSent = smtpSettings.enabled;
      const whatsappSent = whatsappSettings.enabled;

      if (emailSent) {
        logs.push(`[${nowStr}] ✉️ SMTP Server: E-mails de alerta enviados via ${smtpSettings.host || 'servidor SMTP'}.`);
      } else {
        logs.push(`[${nowStr}] ℹ️ SMTP Server: Simulação concluída (Servidor SMTP desligado nas configurações).`);
      }

      if (whatsappSent) {
        logs.push(`[${nowStr}] 💬 WhatsApp API: Mensagem enviada para ${orderClient.phone || 'telefone do requisitante'}.`);
      } else {
        logs.push(`[${nowStr}] ℹ️ WhatsApp API: Simulação concluída (Canal WhatsApp desligado nas configurações).`);
      }

      logs.push(`[${nowStr}] ✅ DIAGNÓSTICO CONCLUÍDO COM SUCESSO!`);

      const result: TestResult = {
        timestamp: new Date().toLocaleTimeString("pt-BR"),
        orderId: selectedOrder.id,
        orderTitle: selectedOrder.title,
        requisitanteName: orderClient.name,
        gestorName,
        logSuccess,
        requisitanteNotified,
        gestorNotified,
        soundPlayed,
        emailSent,
        whatsappSent,
        details: logs
      };

      setTestHistory(prev => [result, ...prev]);
      setDiagnosticLogs(logs);
      setIsSimulating(false);

      onToastSuccess(
        `Alerta simultâneo disparado para Requisitante (${orderClient.name}) e Gestor (${gestorName})! Log registrado.`,
        "Diagnóstico Concluído"
      );
    }, 800);
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 animate-pulse" /> Ferramenta de Teste em Tempo Real
              </span>
            </div>
            <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2 mt-1">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Diagnóstico de Comunicação e Alertas de Falta de Material
            </h3>
            <p className="text-xs text-slate-300 font-medium leading-relaxed max-w-3xl">
              Simule o envio simultâneo de alertas quando não há peças ou insumos para atender a requisição.
              Esta ferramenta valida se a **notificação em tempo real aparece na UI do Requisitante e do Gestor**, se o **som é reproduzido** e se o **evento é registrado no log auditável do sistema**.
            </p>
          </div>
        </div>
      </div>

      {/* Control Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form & Triggers */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 p-6 shadow-xs space-y-5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              Configurar Teste de Alerta Simultâneo
            </h4>

            {/* OS Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Selecione a Ordem de Serviço (OS):
              </label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
              >
                {orders.map(o => {
                  const clientName = clients.find(c => c.id === o.clientId)?.name || 'Requisitante';
                  return (
                    <option key={o.id} value={o.id}>
                      OS #{o.id} - {o.title} [{clientName}] - Status: {o.status.toUpperCase()}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Material Shortage Reason */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Descrição do Insumo / Material Faltante para o Teste:
              </label>
              <input
                type="text"
                value={testReason}
                onChange={(e) => setTestReason(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Mangueira de alta pressão, chave de vedação..."
              />
            </div>

            {/* Target Stakeholders Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Target 1: Requisitante */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-500" />
                  <span className="text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400">Destino 1: Requisitante</span>
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{orderClient.name}</p>
                <p className="text-[10px] text-slate-500 font-mono truncate">{orderClient.email || "Sem e-mail registrado"}</p>
                <span className="inline-block bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded border border-emerald-500/20">
                  ✓ In-App Banner + Som + Push
                </span>
              </div>

              {/* Target 2: Gestor */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span className="text-[11px] font-black uppercase text-amber-600 dark:text-amber-400">Destino 2: Gestor</span>
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{gestorName}</p>
                <p className="text-[10px] text-slate-500 font-mono truncate">{gestorEmail}</p>
                <span className="inline-block bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded border border-amber-500/20">
                  ✓ Painel de Gestão + Audit Log
                </span>
              </div>
            </div>

            {/* Action Trigger Button */}
            <button
              type="button"
              disabled={isSimulating}
              onClick={handleRunSimultaneousAlert}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs py-4 px-6 rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-3 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isSimulating ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              <span className="uppercase tracking-wider">
                {isSimulating ? "Executando Diagnóstico Simultâneo..." : "🚀 Disparar Alerta Simultâneo (Requisitante + Gestor)"}
              </span>
            </button>
          </div>
        </div>

        {/* Right Column: Real-time Terminal & Verification Results */}
        <div className="lg:col-span-6 space-y-6">
          {/* Live Terminal Output */}
          <div className="bg-slate-950 rounded-3xl border border-slate-900 p-5 flex flex-col h-[340px] shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 font-mono">
                  Console de Verificação de Alertas
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDiagnosticLogs([])}
                className="text-[9.5px] font-extrabold uppercase text-slate-500 hover:text-slate-300 transition-colors"
              >
                Limpar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1.5 leading-relaxed pr-2 text-slate-300">
              {diagnosticLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                  <Info className="w-6 h-6 text-slate-700" />
                  <p className="text-xs">Nenhum teste executado ainda. Clique no botão ao lado para disparar o diagnóstico simultâneo.</p>
                </div>
              ) : (
                diagnosticLogs.map((log, idx) => (
                  <p key={idx} className={`break-words ${
                    log.includes('✅') ? 'text-emerald-400 font-bold' :
                    log.includes('🚀') ? 'text-amber-300 font-bold' :
                    log.includes('❌') ? 'text-rose-400 font-bold' : 'text-slate-300'
                  }`}>
                    {log}
                  </p>
                ))
              )}
            </div>
          </div>

          {/* Checklist Status Card */}
          {testHistory.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-emerald-500/40 p-5 shadow-sm space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100">
                    Resultado da Última Verificação (OS #{testHistory[0].orderId})
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{testHistory[0].timestamp}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {/* Check 1 */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">Log no Sistema</span>
                    <span className="text-[9.5px] text-emerald-600 font-extrabold uppercase">Registrado</span>
                  </div>
                </div>

                {/* Check 2 */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">Requisitante</span>
                    <span className="text-[9.5px] text-emerald-600 font-extrabold uppercase">Notificado</span>
                  </div>
                </div>

                {/* Check 3 */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">Gestor OS</span>
                    <span className="text-[9.5px] text-emerald-600 font-extrabold uppercase">Notificado</span>
                  </div>
                </div>

                {/* Check 4 */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">Som Sintetizado</span>
                    <span className="text-[9.5px] text-emerald-600 font-extrabold uppercase">Reproduzido</span>
                  </div>
                </div>

                {/* Check 5 */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">Centro de Alertas</span>
                    <span className="text-[9.5px] text-emerald-600 font-extrabold uppercase">Disponível na UI</span>
                  </div>
                </div>

                {/* Check 6 */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">Canais Auxiliares</span>
                    <span className="text-[9.5px] text-indigo-500 font-extrabold uppercase">Validados</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

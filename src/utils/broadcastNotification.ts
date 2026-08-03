import { ServiceOrder, Client, SmtpSettings, WhatsappSettings, AppNotification } from "../types";
import { playNotificationSound } from "./notificationSound";

export interface BroadcastParams {
  order: ServiceOrder;
  client?: Client | null;
  reason: string;
  category?: "falta_material" | "urgente" | "diagnostico" | "status";
  isDiagnosticTest?: boolean;
  gestorName?: string;
  gestorEmail?: string;
  smtpSettings?: SmtpSettings;
  whatsappSettings?: WhatsappSettings;
  addSystemLog: (
    action: string, 
    details: string, 
    category: "requisicao" | "requisitante" | "tecnico" | "sistema"
  ) => void;
  notifyUser: (notif: {
    title: string;
    message: string;
    type?: AppNotification["type"];
    serviceOrderId?: string;
    soundType?: "chime" | "success" | "alert" | "info";
  }) => void;
  onToastSuccess?: (msg: string, title?: string) => void;
  onToastInfo?: (msg: string, title?: string) => void;
  sendProgrammaticEmail?: (to: string, subject: string, body: string, settings: SmtpSettings) => Promise<any>;
  sendProgrammaticWhatsapp?: (to: string, message: string, settings: WhatsappSettings) => Promise<any>;
}

export interface BroadcastResult {
  success: boolean;
  logSuccess: boolean;
  requisitanteNotified: boolean;
  gestorNotified: boolean;
  soundPlayed: boolean;
  emailSent: boolean;
  whatsappSent: boolean;
  logs: string[];
}

/**
 * Global utility to broadcast simultaneous notifications (Requisitante + Gestor),
 * ensuring system log registration, audio sound feedback, in-app push, and toast alerts.
 */
export async function broadcastNotification(params: BroadcastParams): Promise<BroadcastResult> {
  const {
    order,
    client,
    reason,
    isDiagnosticTest = false,
    gestorName = "Willian C. Lima (Gestor de Serviços)",
    gestorEmail = "willianclima@gmail.com",
    smtpSettings,
    whatsappSettings,
    addSystemLog,
    notifyUser,
    onToastSuccess,
    onToastInfo,
    sendProgrammaticEmail,
    sendProgrammaticWhatsapp
  } = params;

  const logs: string[] = [];
  const nowStr = new Date().toLocaleTimeString("pt-BR");
  const prefix = isDiagnosticTest ? "[TESTE DIAGNÓSTICO] " : "";

  const requisitanteName = client?.name || "Requisitante da OS";
  const requisitanteEmail = client?.email || "requisitante@aracatuba.sp.gov.br";
  const requisitantePhone = client?.phone || "(18) 99881-2200";

  logs.push(`[${nowStr}] 🚀 ${prefix}Iniciando disparo de Alerta Simultâneo (Requisitante + Gestor)...`);
  logs.push(`[${nowStr}] 📋 Ordem de Serviço: #${order.id} - "${order.title}"`);
  logs.push(`[${nowStr}] 👤 Requisitante: ${requisitanteName} (${requisitanteEmail})`);
  logs.push(`[${nowStr}] 🛡️ Gestor de Serviços: ${gestorName} (${gestorEmail})`);
  logs.push(`[${nowStr}] 📦 Motivo / Insumo: "${reason}"`);

  // 1. Immediate Audio Sound Feedback
  let soundPlayed = false;
  try {
    playNotificationSound("alert");
    soundPlayed = true;
    logs.push(`[${nowStr}] 🔊 Audio Synthesizer: Som de alerta 'alert' reproduzido com sucesso via Web Audio API.`);
  } catch (err) {
    logs.push(`[${nowStr}] ⚠️ Audio Synthesizer: Falha no som de alerta (${err}).`);
  }

  // 2. System Log Entry (Audit Trail)
  let logSuccess = false;
  try {
    const logAction = isDiagnosticTest 
      ? "Diagnóstico Alerta Simultâneo" 
      : "Alerta Falta de Material Simultâneo";
    const logDetail = `${prefix}Alerta disparado simultaneamente para OS #${order.id} ("${order.title}"). Insumo/Motivo: "${reason}". Destinatários: Requisitante (${requisitanteName}) e Gestor (${gestorName}).`;

    addSystemLog(logAction, logDetail, "sistema");
    logSuccess = true;
    logs.push(`[${nowStr}] 📝 Sistema de Logs: Evento auditável registrado com sucesso.`);
  } catch (err) {
    logs.push(`[${nowStr}] ❌ Sistema de Logs: Falha ao registrar log (${err}).`);
  }

  // 3. In-App Real-time Notifications (Requisitante + Gestor)
  let requisitanteNotified = false;
  let gestorNotified = false;

  try {
    // Notify Requisitante
    notifyUser({
      title: `⚠️ ${prefix}Falta de Material: OS #${order.id}`,
      message: `Olá ${requisitanteName}, a execução da sua requisição "${order.title}" aguarda insumo: "${reason}".`,
      type: "system_alert",
      serviceOrderId: order.id,
      soundType: "chime"
    });
    requisitanteNotified = true;

    // Notify Gestor
    notifyUser({
      title: `🚨 ${prefix}Alerta de Gestão: OS #${order.id}`,
      message: `Atenção Gestor, a OS #${order.id} (${requisitanteName}) está paralisada por falta de: "${reason}".`,
      type: "system_alert",
      serviceOrderId: order.id,
      soundType: "alert"
    });
    gestorNotified = true;

    logs.push(`[${nowStr}] 🔔 Central de Notificações: In-app Push enfileirado simultaneamente para Requisitante e Gestor.`);
  } catch (err) {
    logs.push(`[${nowStr}] ❌ Central de Notificações: Erro no envio in-app (${err}).`);
  }

  // 4. Toast Visual Feedback
  if (onToastSuccess) {
    onToastSuccess(
      `Alerta enviado simultaneamente para o Requisitante (${requisitanteName}) e Gestor (${gestorName})!`,
      `${prefix}Alerta Disparado`
    );
  } else if (onToastInfo) {
    onToastInfo(
      `Notificação simultânea processada para OS #${order.id}.`,
      "Broadcast Concluído"
    );
  }

  // 5. External Channels (SMTP Email & WhatsApp)
  let emailSent = false;
  let whatsappSent = false;

  if (smtpSettings?.enabled && sendProgrammaticEmail) {
    try {
      // Requisitante Email
      if (requisitanteEmail) {
        const reqSubject = `⚠️ ${prefix}Notificação de Material Pendente: OS #${order.id}`;
        const reqContent = `Prezado(a) ${requisitanteName},\n\n` +
          `Informamos que a execução da sua Ordem de Serviço #${order.id} ("${order.title}") aguarda o seguinte insumo/material:\n\n` +
          `📦 **Material Requerido:** ${reason}\n\n` +
          `Nossa gestão e o almoxarifado foram acionados para providenciar o item.\n\n` +
          `Atenciosamente,\nAraçatuba Serviços de Manutenção`;
        await sendProgrammaticEmail(requisitanteEmail, reqSubject, reqContent, smtpSettings);
      }

      // Gestor Email
      if (gestorEmail) {
        const gestorSubject = `🚨 ${prefix}ALERTA GESTÃO: Material Faltante na OS #${order.id}`;
        const gestorContent = `Atenção Gestor,\n\n` +
          `A OS #${order.id} ("${order.title}") foi sinalizada com PARALISAÇÃO POR FALTA DE MATERIAL.\n\n` +
          `- **Requisitante:** ${requisitanteName}\n` +
          `- **Material Pendente:** ${reason}\n\n` +
          `Acesse o sistema para autorizar a transferência ou compra de estoque.\n\n` +
          `Sistema de Gestão Araçatuba`;
        await sendProgrammaticEmail(gestorEmail, gestorSubject, gestorContent, smtpSettings);
      }

      emailSent = true;
      logs.push(`[${nowStr}] ✉️ Servidor SMTP: E-mails enviados para ${requisitanteEmail} e ${gestorEmail}.`);
    } catch (err) {
      logs.push(`[${nowStr}] ⚠️ Servidor SMTP: Erro ao enviar e-mails (${err}).`);
    }
  } else {
    logs.push(`[${nowStr}] ℹ️ Servidor SMTP: Não ativo ou não configurado.`);
  }

  if (whatsappSettings?.enabled && sendProgrammaticWhatsapp && requisitantePhone) {
    try {
      const waMsg = `⚠️ *${prefix}Araçatuba Serviços - Falta de Material (OS #${order.id})*\n\n` +
        `Olá, *${requisitanteName}*!\n\n` +
        `Sua ordem de serviço *${order.title}* aguarda o item:\n` +
        `📦 *Insumo:* ${reason}\n\n` +
        `Equipe de gestão acionada em tempo real.`;
      await sendProgrammaticWhatsapp(requisitantePhone, waMsg, whatsappSettings);
      whatsappSent = true;
      logs.push(`[${nowStr}] 💬 WhatsApp API: Notificação enviada para ${requisitantePhone}.`);
    } catch (err) {
      logs.push(`[${nowStr}] ⚠️ WhatsApp API: Erro no envio (${err}).`);
    }
  } else {
    logs.push(`[${nowStr}] ℹ️ WhatsApp API: Não ativo ou telefone não cadastrado.`);
  }

  logs.push(`[${nowStr}] ✅ Broadcast de Notificação Simultânea Finalizado.`);

  return {
    success: logSuccess && requisitanteNotified && gestorNotified,
    logSuccess,
    requisitanteNotified,
    gestorNotified,
    soundPlayed,
    emailSent,
    whatsappSent,
    logs
  };
}

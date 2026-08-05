import { ServiceOrder, ServiceCategory, AppNotification, SystemLog, SlaReminderLog } from "../types";
import { playNotificationSound } from "./notificationSound";

export interface OsSlaInfo {
  osId: string;
  osTitle: string;
  categoryName: string;
  status: 'em_dia' | 'vencendo_logo' | 'vencido' | 'concluido';
  slaHours: number;
  createdAt: string;
  deadlineDate: Date;
  deadlineFormatted: string;
  timeElapsedMs: number;
  timeRemainingMs: number;
  percentageElapsed: number;
  isOverdue: boolean;
  isExpiringSoon: boolean;
  formattedRemaining: string;
  assignedTo: string;
  osStatus: string;
  reminderIntervalHours: number;
  reminderEnabled: boolean;
}

export const DEFAULT_SLA_HOURS = 48;
export const DEFAULT_REMINDER_INTERVAL_HOURS = 6;

/**
 * Retorna as configurações de SLA para uma determinada categoria
 */
export function getCategorySlaConfig(categoryName: string, categories: ServiceCategory[]) {
  const cat = categories.find(c => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase());
  return {
    slaHours: cat?.slaHours && cat.slaHours > 0 ? cat.slaHours : DEFAULT_SLA_HOURS,
    reminderIntervalHours: cat?.reminderIntervalHours && cat.reminderIntervalHours > 0 ? cat.reminderIntervalHours : DEFAULT_REMINDER_INTERVAL_HOURS,
    reminderEnabled: cat?.reminderEnabled !== false,
    notifyGestor: cat?.notifyGestor !== false,
    notifyTechnician: cat?.notifyTechnician !== false
  };
}

/**
 * Calcula métricas e status detalhado de SLA de uma Ordem de Serviço
 */
export function calculateOsSlaStatus(os: ServiceOrder, categories: ServiceCategory[], nowMs = Date.now()): OsSlaInfo {
  const config = getCategorySlaConfig(os.category, categories);
  const createdAtMs = new Date(os.createdAt).getTime();
  const deadlineMs = createdAtMs + (config.slaHours * 3600 * 1000);
  const deadlineDate = new Date(deadlineMs);

  const timeElapsedMs = Math.max(0, nowMs - createdAtMs);
  const timeRemainingMs = deadlineMs - nowMs;
  const totalDurationMs = config.slaHours * 3600 * 1000;
  
  const percentageElapsed = Math.min(100, Math.max(0, Math.round((timeElapsedMs / totalDurationMs) * 100)));

  const isCompletedOrCancelled = os.status === 'concluido' || os.status === 'cancelado';
  const isOverdue = !isCompletedOrCancelled && timeRemainingMs < 0;
  
  // Vencendo logo se restam menos de 25% do tempo total ou menos de 4 horas
  const expiringThresholdMs = Math.min(4 * 3600 * 1000, totalDurationMs * 0.25);
  const isExpiringSoon = !isCompletedOrCancelled && !isOverdue && timeRemainingMs <= expiringThresholdMs;

  let status: 'em_dia' | 'vencendo_logo' | 'vencido' | 'concluido' = 'em_dia';
  if (isCompletedOrCancelled) {
    status = 'concluido';
  } else if (isOverdue) {
    status = 'vencido';
  } else if (isExpiringSoon) {
    status = 'vencendo_logo';
  }

  // Formatação amigável do tempo restante/excedido
  let formattedRemaining = "";
  if (isCompletedOrCancelled) {
    formattedRemaining = "SLA Concluído";
  } else if (isOverdue) {
    const overdueMins = Math.floor(Math.abs(timeRemainingMs) / (1000 * 60));
    const hours = Math.floor(overdueMins / 60);
    const mins = overdueMins % 60;
    formattedRemaining = `Expirada há ${hours > 0 ? `${hours}h ` : ''}${mins}m`;
  } else {
    const remainMins = Math.floor(timeRemainingMs / (1000 * 60));
    const hours = Math.floor(remainMins / 60);
    const mins = remainMins % 60;
    formattedRemaining = `Restam ${hours > 0 ? `${hours}h ` : ''}${mins}m`;
  }

  const deadlineFormatted = deadlineDate.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  return {
    osId: os.id,
    osTitle: os.title,
    categoryName: os.category,
    status,
    slaHours: config.slaHours,
    createdAt: os.createdAt,
    deadlineDate,
    deadlineFormatted,
    timeElapsedMs,
    timeRemainingMs,
    percentageElapsed,
    isOverdue,
    isExpiringSoon,
    formattedRemaining,
    assignedTo: os.assignedTo || "Técnico Não Atribuído",
    osStatus: os.status,
    reminderIntervalHours: config.reminderIntervalHours,
    reminderEnabled: config.reminderEnabled
  };
}

/**
 * Processador do motor automático de lembretes de SLA
 */
export function checkAndTriggerSlaReminders(
  orders: ServiceOrder[],
  categories: ServiceCategory[],
  notifications: AppNotification[],
  onAddNotification: (notif: AppNotification) => void,
  onAddSystemLog?: (action: string, details: string, category: "requisicao" | "requisitante" | "tecnico" | "sistema") => void
): { newRemindersCount: number; updatedLogs: SlaReminderLog[] } {
  if (typeof window === "undefined") return { newRemindersCount: 0, updatedLogs: [] };

  const STORAGE_KEY = "gestao_servicos_sla_reminder_tracker";
  const LOGS_KEY = "gestao_servicos_sla_reminder_history";

  let tracker: Record<string, number> = {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) tracker = JSON.parse(saved);
  } catch (e) {
    console.error("Erro ao ler tracker de SLA", e);
  }

  let reminderLogs: SlaReminderLog[] = [];
  try {
    const savedLogs = localStorage.getItem(LOGS_KEY);
    if (savedLogs) reminderLogs = JSON.parse(savedLogs);
  } catch (e) {
    console.error("Erro ao ler histórico de lembretes SLA", e);
  }

  const nowMs = Date.now();
  let createdCount = 0;

  // Filtra apenas OS ativas em status 'aberto' ou 'em_progresso'
  const activeOrders = orders.filter(o => o.status === 'aberto' || o.status === 'em_progresso');

  for (const os of activeOrders) {
    const slaInfo = calculateOsSlaStatus(os, categories, nowMs);
    
    // Se lembretes desativados na categoria, pula
    if (!slaInfo.reminderEnabled) continue;

    const trackerKeyWarning = `os_${os.id}_warning`;
    const trackerKeyExpired = `os_${os.id}_expired`;
    const lastExpiredSentMs = tracker[trackerKeyExpired] || 0;
    const lastWarningSentMs = tracker[trackerKeyWarning] || 0;

    const intervalMs = slaInfo.reminderIntervalHours * 3600 * 1000;

    // 1. Caso a OS esteja com SLA EXPIRADO / VENCIDO
    if (slaInfo.isOverdue) {
      // Dispara lembrete se nunca disparou ou se passou o intervalo de reenvio
      if (nowMs - lastExpiredSentMs >= intervalMs) {
        tracker[trackerKeyExpired] = nowMs;
        createdCount++;

        const notif: AppNotification = {
          id: `notif-sla-exp-${os.id}-${nowMs}`,
          title: `🚨 Lembrete de SLA Expirado (OS #${os.id})`,
          message: `A Ordem de Serviço "${os.title}" (${os.category}) com status "${os.status === 'aberto' ? 'Aberto' : 'Em Progresso'}" ultrapassou o limite do SLA de ${slaInfo.slaHours}h. ${slaInfo.formattedRemaining}. Técnico: ${slaInfo.assignedTo}.`,
          timestamp: new Date().toISOString(),
          type: 'system_alert',
          read: false,
          serviceOrderId: os.id
        };

        onAddNotification(notif);

        if (onAddSystemLog) {
          onAddSystemLog(
            "Lembrete Automático de SLA",
            `Lembrete automático de expiração do SLA enviado para a OS #${os.id} (${os.title}). Categoria: ${os.category} (SLA: ${slaInfo.slaHours}h).`,
            "sistema"
          );
        }

        const logEntry: SlaReminderLog = {
          id: `log-sla-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          osId: os.id,
          osTitle: os.title,
          categoryName: os.category,
          reminderType: 'expired',
          recipientName: os.assignedTo || 'Gestão Geral',
          recipientRole: 'Técnico / Gestor',
          sentAt: new Date().toISOString(),
          slaHours: slaInfo.slaHours,
          timeOverdueMinutes: Math.floor(Math.abs(slaInfo.timeRemainingMs) / (1000 * 60)),
          message: notif.message
        };

        reminderLogs.unshift(logEntry);

        // Notificação sonora discreta se suporte no navegador
        try { playNotificationSound('alert'); } catch (e) {}

        // Notificação push via Service Worker se ativo
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_SLA_NOTIFICATION',
            title: notif.title,
            body: notif.message,
            osId: os.id
          });
        }
      }
    }
    // 2. Caso a OS esteja PRÓXIMA DO VENCIMENTO (Aviso de SLA)
    else if (slaInfo.isExpiringSoon && !lastWarningSentMs) {
      tracker[trackerKeyWarning] = nowMs;
      createdCount++;

      const notif: AppNotification = {
        id: `notif-sla-warn-${os.id}-${nowMs}`,
        title: `⚠️ Aviso de SLA Próximo do Vencimento (OS #${os.id})`,
        message: `A OS "${os.title}" (${os.category}) vence em breve! Prazo SLA: ${slaInfo.slaHours}h (${slaInfo.formattedRemaining}). Atribuído: ${slaInfo.assignedTo}.`,
        timestamp: new Date().toISOString(),
        type: 'os_status',
        read: false,
        serviceOrderId: os.id
      };

      onAddNotification(notif);

      if (onAddSystemLog) {
        onAddSystemLog(
          "Aviso de Proximidade de SLA",
          `Alerta de proximidade do prazo do SLA enviado para a OS #${os.id} (${os.title}). Restam ${slaInfo.formattedRemaining}.`,
          "sistema"
        );
      }

      const logEntry: SlaReminderLog = {
        id: `log-sla-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        osId: os.id,
        osTitle: os.title,
        categoryName: os.category,
        reminderType: 'warning',
        recipientName: os.assignedTo || 'Gestão Geral',
        recipientRole: 'Técnico / Gestor',
        sentAt: new Date().toISOString(),
        slaHours: slaInfo.slaHours,
        message: notif.message
      };

      reminderLogs.unshift(logEntry);
    }
  }

  // Persiste trackers e histórico no localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracker));
    // Mantém no máximo os 100 últimos registros de log de lembretes
    const trimmedLogs = reminderLogs.slice(0, 100);
    localStorage.setItem(LOGS_KEY, JSON.stringify(trimmedLogs));
  } catch (e) {
    console.error("Erro ao salvar histórico de lembretes SLA", e);
  }

  return { newRemindersCount: createdCount, updatedLogs: reminderLogs };
}

/**
 * Disparo manual imediato de lembrete de SLA para um técnico ou gestor
 */
export function triggerManualSlaReminder(
  os: ServiceOrder,
  categories: ServiceCategory[],
  onAddNotification: (notif: AppNotification) => void,
  onAddSystemLog?: (action: string, details: string, category: "requisicao" | "requisitante" | "tecnico" | "sistema") => void
): SlaReminderLog {
  const slaInfo = calculateOsSlaStatus(os, categories);
  const now = new Date();

  const notif: AppNotification = {
    id: `notif-sla-manual-${os.id}-${now.getTime()}`,
    title: `🔔 Lembrete Manual de SLA enviado pelo Gestor (OS #${os.id})`,
    message: `Atenção: O Gestor enviou um lembrete direto para a OS "${os.title}". Categoria: ${os.category}. Status SLA: ${slaInfo.formattedRemaining}. Técnico: ${slaInfo.assignedTo}.`,
    timestamp: now.toISOString(),
    type: 'system_alert',
    read: false,
    serviceOrderId: os.id
  };

  onAddNotification(notif);

  if (onAddSystemLog) {
    onAddSystemLog(
      "Lembrete Manual de SLA Disparado",
      `Lembrete de cobrança de SLA disparado manualmente pelo gestor para a OS #${os.id} ("${os.title}").`,
      "sistema"
    );
  }

  const logEntry: SlaReminderLog = {
    id: `log-sla-${now.getTime()}`,
    osId: os.id,
    osTitle: os.title,
    categoryName: os.category,
    reminderType: 'manual',
    recipientName: os.assignedTo || 'Gestão de Serviços',
    recipientRole: 'Técnico Atribuído',
    sentAt: now.toISOString(),
    slaHours: slaInfo.slaHours,
    timeOverdueMinutes: slaInfo.isOverdue ? Math.floor(Math.abs(slaInfo.timeRemainingMs) / (1000 * 60)) : undefined,
    message: notif.message
  };

  // Salva no histórico local
  try {
    const LOGS_KEY = "gestao_servicos_sla_reminder_history";
    const savedLogs = localStorage.getItem(LOGS_KEY);
    const existing: SlaReminderLog[] = savedLogs ? JSON.parse(savedLogs) : [];
    const updated = [logEntry, ...existing].slice(0, 100);
    localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
  } catch (e) {}

  return logEntry;
}

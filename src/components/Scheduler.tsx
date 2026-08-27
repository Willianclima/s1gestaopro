import React, { useState, useEffect } from "react";
import { ServiceOrder, Client, BlockedDate, Professional, CurrentUser, TravelReminder, ServiceCategory, AppNotification, SlaReminderLog } from "../types";
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, CheckCircle, 
  ArrowRight, Plus, Lock, Trash2, ShieldAlert, Sparkles, AlertTriangle, HelpCircle,
  Navigation, MapPin, Bell, Volume2, Car, Bike, Bus, Footprints, Send, CheckCircle2, X, Edit2,
  Timer, Hourglass, ShieldCheck, Zap, RefreshCw, Filter, Search, Sliders, Check, BellRing
} from "lucide-react";
import { playNotificationSound } from "../utils/notificationSound";
import { calculateOsSlaStatus, triggerManualSlaReminder, checkAndTriggerSlaReminders, OsSlaInfo } from "../utils/slaUtils";
import { useToast } from "./ToastContext";

interface SchedulerProps {
  orders: ServiceOrder[];
  clients: Client[];
  onQuickScheduleOrder?: (date: string) => void;
  currentUser?: CurrentUser;
  professionalsList?: Professional[];
  blockedDates?: BlockedDate[];
  onAddBlockedDate?: (bDate: BlockedDate) => void;
  onDeleteBlockedDate?: (id: string) => void;
  globalSearchTerm?: string;
  categories?: ServiceCategory[];
  onUpdateCategory?: (category: ServiceCategory) => void;
  onAddNotification?: (notif: AppNotification) => void;
  onAddSystemLog?: (action: string, details: string, category: "requisicao" | "requisitante" | "tecnico" | "sistema") => void;
}

export default function Scheduler({ 
  orders, 
  clients, 
  onQuickScheduleOrder,
  currentUser,
  professionalsList = [],
  blockedDates = [],
  onAddBlockedDate,
  onDeleteBlockedDate,
  globalSearchTerm,
  categories = [],
  onUpdateCategory,
  onAddNotification,
  onAddSystemLog
}: SchedulerProps) {
  const { toastSuccess, toastInfo, toastWarn } = useToast();

  // Helper functions for local computer date
  const getLocalTodayDate = () => new Date();
  const getLocalTodayDateStr = () => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const dy = String(now.getDate()).padStart(2, "0");
    return `${yr}-${mo}-${dy}`;
  };

  // Always open on the current computer date (month, year and day)
  const [currentDate, setCurrentDate] = useState<Date>(() => getLocalTodayDate());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => getLocalTodayDateStr());

  // Ensure every time the component opens or mounts, it synchronizes strictly with the computer's current month and day
  useEffect(() => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(getLocalTodayDateStr());
  }, []);

  const [newBlockDate, setNewBlockDate] = useState<string>(() => getLocalTodayDateStr());
  const [newBlockDescription, setNewBlockDescription] = useState("");
  const [newBlockType, setNewBlockType] = useState<"holiday" | "day_off">("holiday");
  const [newBlockProfId, setNewBlockProfId] = useState("all");
  const [blockError, setBlockError] = useState("");

  // View mode selector
  const [viewMode, setViewMode] = useState<"general" | "blocked_calendar" | "travel_reminders" | "sla_reminders">("general");
  const [blockFilterType, setBlockFilterType] = useState<"all" | "holiday" | "day_off">("all");
  const [blockFilterProf, setBlockFilterProf] = useState<string>("all");

  // SLA Management State
  const [slaFilter, setSlaFilter] = useState<'all' | 'em_dia' | 'vencendo_logo' | 'vencido'>('all');
  const [slaSearchTerm, setSlaSearchTerm] = useState('');
  const [editingCatSla, setEditingCatSla] = useState<ServiceCategory | null>(null);
  const [catSlaHoursInput, setCatSlaHoursInput] = useState<number>(24);
  const [catReminderIntervalInput, setCatReminderIntervalInput] = useState<number>(4);
  const [catReminderEnabledInput, setCatReminderEnabledInput] = useState<boolean>(true);
  const [catNotifyGestorInput, setCatNotifyGestorInput] = useState<boolean>(true);
  const [catNotifyTechInput, setCatNotifyTechInput] = useState<boolean>(true);

  // SLA Reminder History logs state
  const [slaLogs, setSlaLogs] = useState<SlaReminderLog[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("gestao_servicos_sla_reminder_history");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const loadSlaLogs = () => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("gestao_servicos_sla_reminder_history");
        if (saved) setSlaLogs(JSON.parse(saved));
      } catch (e) {}
    }
  };

  // Notification API Permission State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });

  // Travel Reminders state initialized with local storage persistence
  const [travelReminders, setTravelReminders] = useState<TravelReminder[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gestao_servicos_travel_reminders");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Erro ao carregar lembretes de deslocamento do localStorage", e);
        }
      }
    }
    const todayStr = getLocalTodayDateStr();
    return [
      {
        id: "rem-101",
        orderId: orders[0]?.id || "101",
        technicianId: currentUser?.name || "Técnico Silva",
        technicianName: currentUser?.name || "Técnico Silva",
        travelTimeMinutes: 30,
        leadTimeMinutes: 10,
        transportMode: "car",
        notes: "Passar no Almoxarifado Central para retirar cabos e peças antes do deslocamento.",
        scheduledDate: todayStr,
        scheduledTime: "14:00",
        calculatedDepartureTime: `${todayStr} 13:20`,
        notifyBrowser: true,
        notifyInApp: true,
        status: "active",
        createdAt: new Date().toISOString()
      }
    ];
  });

  // Modal State for Quick Travel Reminder Setup
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [selectedOSForReminder, setSelectedOSForReminder] = useState<ServiceOrder | null>(null);

  // Form inputs for creating/editing a Travel Reminder
  const [reminderOrderId, setReminderOrderId] = useState<string>(orders[0]?.id || "");
  const [reminderTechName, setReminderTechName] = useState<string>(currentUser?.name || "");
  const [reminderTravelMins, setReminderTravelMins] = useState<number>(30);
  const [reminderLeadMins, setReminderLeadMins] = useState<number>(10);
  const [reminderTransportMode, setReminderTransportMode] = useState<"car" | "motorcycle" | "transit" | "walking">("car");
  const [reminderScheduledDate, setReminderScheduledDate] = useState<string>(() => getLocalTodayDateStr());
  const [reminderScheduledTime, setReminderScheduledTime] = useState<string>("14:00");
  const [reminderNotes, setReminderNotes] = useState<string>("");
  const [reminderNotifyBrowser, setReminderNotifyBrowser] = useState<boolean>(true);
  const [reminderNotifyInApp, setReminderNotifyInApp] = useState<boolean>(true);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);

  // Triggered alert popup overlay
  const [triggeredReminder, setTriggeredReminder] = useState<TravelReminder | null>(null);

  // Travel Reminders filter tab
  const [reminderStatusFilter, setReminderStatusFilter] = useState<"all" | "active" | "notified">("all");

  const saveRemindersToStorage = (updated: TravelReminder[]) => {
    setTravelReminders(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("gestao_servicos_travel_reminders", JSON.stringify(updated));
    }
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const res = await Notification.requestPermission();
        setNotificationPermission(res);
        if (res === "granted") {
          new Notification("🔔 Notificações Ativadas!", {
            body: "Você receberá alertas automáticos de deslocamento para ordens de serviço no seu navegador.",
            icon: "/favicon.ico"
          });
        }
      } catch (e) {
        console.error("Erro ao solicitar permissão de notificação", e);
      }
    }
  };

  const handleTestNotification = () => {
    playNotificationSound("alert");
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("🧪 Teste de Alerta de Deslocamento", {
        body: "Alerta sonoro e notificação nativa funcionando perfeitamente! Você será avisado no horário recomendado de saída.",
        icon: "/favicon.ico"
      });
    }
  };

  const calculateDepartureTimeStr = (dateStr: string, timeStr: string, travelMins: number, leadMins: number) => {
    if (!dateStr || !timeStr) return "N/I";
    try {
      const [h, m] = timeStr.split(":").map(Number);
      const dt = new Date(`${dateStr}T${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:00`);
      dt.setMinutes(dt.getMinutes() - (travelMins + leadMins));
      const dStr = dt.toISOString().split("T")[0];
      const tStr = dt.toTimeString().slice(0, 5);
      return `${dStr} ${tStr}`;
    } catch (e) {
      return `${dateStr} ${timeStr}`;
    }
  };

  const handleSaveReminder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!reminderOrderId) return;

    const matchedOS = orders.find(o => o.id === reminderOrderId);
    const calculatedDep = calculateDepartureTimeStr(reminderScheduledDate, reminderScheduledTime, reminderTravelMins, reminderLeadMins);

    if (editingReminderId) {
      const updatedList = travelReminders.map(r => r.id === editingReminderId ? {
        ...r,
        orderId: reminderOrderId,
        technicianName: reminderTechName || matchedOS?.assignedTo || currentUser?.name || "Técnico",
        travelTimeMinutes: Number(reminderTravelMins),
        leadTimeMinutes: Number(reminderLeadMins),
        transportMode: reminderTransportMode,
        scheduledDate: reminderScheduledDate,
        scheduledTime: reminderScheduledTime,
        calculatedDepartureTime: calculatedDep,
        notes: reminderNotes,
        notifyBrowser: reminderNotifyBrowser,
        notifyInApp: reminderNotifyInApp,
        status: "active" as const
      } : r);
      saveRemindersToStorage(updatedList);
      setEditingReminderId(null);
    } else {
      const newRem: TravelReminder = {
        id: "rem-" + Math.random().toString(36).substr(2, 9),
        orderId: reminderOrderId,
        technicianId: currentUser?.name || "Técnico",
        technicianName: reminderTechName || matchedOS?.assignedTo || currentUser?.name || "Técnico",
        travelTimeMinutes: Number(reminderTravelMins),
        leadTimeMinutes: Number(reminderLeadMins),
        transportMode: reminderTransportMode,
        scheduledDate: reminderScheduledDate,
        scheduledTime: reminderScheduledTime,
        calculatedDepartureTime: calculatedDep,
        notes: reminderNotes,
        notifyBrowser: reminderNotifyBrowser,
        notifyInApp: reminderNotifyInApp,
        status: "active",
        createdAt: new Date().toISOString()
      };
      saveRemindersToStorage([newRem, ...travelReminders]);
    }

    // Reset form & close modal
    setReminderNotes("");
    setIsReminderModalOpen(false);
  };

  const handleOpenReminderForOS = (os: ServiceOrder) => {
    setSelectedOSForReminder(os);
    setEditingReminderId(null);
    setReminderOrderId(os.id);
    setReminderScheduledDate(os.startDate || selectedDateStr);
    setReminderScheduledTime("14:00");
    setReminderTechName(os.assignedTo || currentUser?.name || "");
    setReminderNotes(`Atendimento de ${os.title}`);
    setIsReminderModalOpen(true);
  };

  const handleEditReminder = (rem: TravelReminder) => {
    setEditingReminderId(rem.id);
    setReminderOrderId(rem.orderId);
    setReminderTechName(rem.technicianName || "");
    setReminderTravelMins(rem.travelTimeMinutes);
    setReminderLeadMins(rem.leadTimeMinutes);
    setReminderTransportMode(rem.transportMode);
    setReminderScheduledDate(rem.scheduledDate);
    setReminderScheduledTime(rem.scheduledTime);
    setReminderNotes(rem.notes || "");
    setReminderNotifyBrowser(rem.notifyBrowser);
    setReminderNotifyInApp(rem.notifyInApp);
    setIsReminderModalOpen(true);
  };

  const handleDeleteReminder = (id: string) => {
    const filtered = travelReminders.filter(r => r.id !== id);
    saveRemindersToStorage(filtered);
  };

  // Realtime background check for scheduled departure times
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = (now.getMonth() + 1).toString().padStart(2, "0");
      const dy = now.getDate().toString().padStart(2, "0");
      const hr = now.getHours().toString().padStart(2, "0");
      const mn = now.getMinutes().toString().padStart(2, "0");
      const currentStamp = `${yr}-${mo}-${dy} ${hr}:${mn}`;

      setTravelReminders(prev => {
        let changed = false;
        const next = prev.map(rem => {
          if (rem.status === "active" && rem.calculatedDepartureTime) {
            const depNormalized = rem.calculatedDepartureTime.replace(" às ", " ");
            if (currentStamp >= depNormalized) {
              changed = true;
              if (rem.notifyBrowser && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                try {
                  new Notification(`🚨 Hora de Deslocamento - OS #${rem.orderId}`, {
                    body: `Inicie o deslocamento para atendimento às ${rem.scheduledTime}. Tempo estimado: ${rem.travelTimeMinutes} min. ${rem.notes ? 'Obs: ' + rem.notes : ''}`,
                    icon: "/favicon.ico"
                  });
                } catch (e) {
                  console.error(e);
                }
              }
              if (rem.notifyInApp) {
                playNotificationSound("alert");
                setTriggeredReminder(rem);
              }
              return { ...rem, status: "notified" as const };
            }
          }
          return rem;
        });

        if (changed) {
          if (typeof window !== "undefined") {
            localStorage.setItem("gestao_servicos_travel_reminders", JSON.stringify(next));
          }
          return next;
        }
        return prev;
      });
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    setBlockError("");
    
    if (!newBlockDate) {
      setBlockError("Por favor, selecione uma data.");
      return;
    }
    if (!newBlockDescription.trim()) {
      setBlockError("Por favor, insira uma descrição.");
      return;
    }
    if (newBlockType === "day_off" && (newBlockProfId === "all" || !newBlockProfId)) {
      setBlockError("Por favor, selecione o técnico para a folga.");
      return;
    }
    
    if (onAddBlockedDate) {
      onAddBlockedDate({
        id: "block-" + Math.random().toString(36).substr(2, 9),
        date: newBlockDate,
        description: newBlockDescription.trim(),
        type: newBlockType,
        professionalId: newBlockType === "holiday" ? "all" : newBlockProfId
      });
      // Reset form
      setNewBlockDescription("");
      setBlockError("");
    }
  };

  const getClientName = (id: string) => {
    const c = clients.find(cl => cl.id === id);
    return c ? c.name : "Requisitante Desconhecido";
  };

  // Days in month calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Create grid arrays
  const blanks = Array(firstDayIndex).fill(null);
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);
  const calendarGrid = [...blanks, ...days];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleGoToToday = () => {
    const today = getLocalTodayDate();
    setCurrentDate(today);
    setSelectedDateStr(getLocalTodayDateStr());
  };

  // Convert day number to string date YYYY-MM-DD
  const getFormattedDateString = (day: number) => {
    const mStr = (month + 1).toString().padStart(2, "0");
    const dStr = day.toString().padStart(2, "0");
    return `${year}-${mStr}-${dStr}`;
  };

  // Find orders for a given date string
  const getOrdersForDate = (dateString: string) => {
    let dayOrders = orders.filter(os => os.startDate === dateString || os.endDate === dateString);
    if (globalSearchTerm && globalSearchTerm.trim()) {
      const q = globalSearchTerm.toLowerCase().trim();
      dayOrders = dayOrders.filter(os => {
        const client = clients.find(c => c.id === os.clientId);
        return os.id.toLowerCase().includes(q) ||
               os.title.toLowerCase().includes(q) ||
               (os.assignedTo && os.assignedTo.toLowerCase().includes(q)) ||
               (client && client.name.toLowerCase().includes(q)) ||
               os.category.toLowerCase().includes(q);
      });
    }
    return dayOrders;
  };

  const selectedDayOrders = getOrdersForDate(selectedDateStr);

  // Month-specific blocks calculation for the interactive calendar filters and timeline
  const currentMonthBlocks = blockedDates.filter(b => {
    const [bYear, bMonth] = b.date.split("-").map(Number);
    return bYear === year && (bMonth - 1) === month;
  }).filter(b => {
    if (blockFilterType === "holiday" && b.type !== "holiday") return false;
    if (blockFilterType === "day_off" && b.type !== "day_off") return false;
    if (blockFilterProf !== "all" && b.type === "day_off" && b.professionalId !== blockFilterProf) return false;
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  // Active Monitored OS SLA calculations for SLA view & tab badge
  const activeMonitoredOrders = orders.filter(o => o.status === 'aberto' || o.status === 'em_progresso');
  const monitoredSlaInfos = activeMonitoredOrders.map(o => calculateOsSlaStatus(o, categories));
  const overdueSlaCount = monitoredSlaInfos.filter(i => i.isOverdue).length;
  const expiringSoonSlaCount = monitoredSlaInfos.filter(i => i.isExpiringSoon).length;
  const healthySlaCount = monitoredSlaInfos.filter(i => i.status === 'em_dia').length;

  return (
    <div className="space-y-6">
      {/* Header and Mode Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Agenda de Atendimentos</h1>
          <p className="text-sm text-slate-500 font-medium font-sans">Acompanhe prazos de início/conclusão de serviços, SLAs por categoria ou planeje feriados e folgas técnicas.</p>
        </div>
        
        {/* Modern Segmented Control */}
        <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-1 rounded-xl self-start md:self-center shadow-xs flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setViewMode("general")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === "general"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-400"
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>Calendário de Serviços</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("blocked_calendar")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === "blocked_calendar"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-400"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Feriados & Folgas</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("travel_reminders")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === "travel_reminders"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-400"
            }`}
          >
            <Navigation className="w-3.5 h-3.5 text-emerald-300" />
            <span>Lembretes de Deslocamento</span>
            {travelReminders.filter(r => r.status === "active").length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[9px] font-black bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-full">
                {travelReminders.filter(r => r.status === "active").length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode("sla_reminders");
              loadSlaLogs();
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === "sla_reminders"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/10"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-400"
            }`}
          >
            <Timer className="w-3.5 h-3.5 text-amber-300" />
            <span>SLAs & Lembretes Automáticos</span>
            {(overdueSlaCount > 0 || expiringSoonSlaCount > 0) && (
              <span className={`ml-1 px-1.5 py-0.2 text-[9px] font-black rounded-full ${
                overdueSlaCount > 0 ? "bg-red-500 text-white animate-pulse" : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
              }`}>
                {overdueSlaCount > 0 ? `${overdueSlaCount} Vencidas` : `${expiringSoonSlaCount} Alertas`}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* SLA & AUTOMATIC REMINDERS TAB VIEW */}
      {viewMode === "sla_reminders" && (
        <div className="space-y-6">
          {/* Hero Banner & Quick Actions */}
          <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-indigo-950 text-white rounded-2xl p-5 shadow-xl border border-amber-800/40 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Timer className="w-6 h-6 animate-pulse text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                    Sistema de SLAs & Lembretes Automáticos por Categoria
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 font-extrabold uppercase px-2 py-0.5 rounded-full border border-amber-500/30">
                      Monitoramento Ativo
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300 font-medium">
                    Defina prazos de expiração (SLAs) para cada categoria e acompanhe os disparos automáticos para OS em aberto ou em progresso.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onAddNotification) {
                      const res = checkAndTriggerSlaReminders(orders, categories, [], onAddNotification, onAddSystemLog);
                      loadSlaLogs();
                      toastSuccess(`Verificação concluída. ${res.newRemindersCount} novos lembretes gerados.`, "SLAs Atualizados");
                    }
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Executar Verificação Manual</span>
                </button>
              </div>
            </div>

            {/* SLA Metrics Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                  <Hourglass className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-black text-white">{activeMonitoredOrders.length}</div>
                  <div className="text-[11px] text-slate-400 font-medium">OS sob Monitoramento</div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-black text-emerald-400">{healthySlaCount}</div>
                  <div className="text-[11px] text-slate-400 font-medium">SLAs Em Dia</div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-black text-amber-400">{expiringSoonSlaCount}</div>
                  <div className="text-[11px] text-slate-400 font-medium">Vencendo em Breve</div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 bg-red-500/20 text-red-400 rounded-lg">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-black text-red-400">{overdueSlaCount}</div>
                  <div className="text-[11px] text-slate-400 font-medium">SLAs Vencidos / Expirados</div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: SLA CONFIGURATION BY CATEGORY */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-600" />
                  <span>Configuração de SLAs e Frequência por Categoria de Serviço</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  O gestor pode definir prazos limite (em horas) e o intervalo de disparos de lembretes automáticos para cada categoria.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat) => {
                const catSla = cat.slaHours || 48;
                const catInterval = cat.reminderIntervalHours || 6;
                const catEnabled = cat.reminderEnabled !== false;

                const activeCountForCat = activeMonitoredOrders.filter(o => o.category === cat.name).length;

                return (
                  <div 
                    key={cat.id} 
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 hover:border-amber-400 dark:hover:border-amber-500 transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full inline-block`} style={{ backgroundColor: cat.color }}></span>
                          {cat.name}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          catEnabled 
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700" 
                            : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}>
                          {catEnabled ? "Lembretes Ativos" : "Pausado"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-extrabold block">Prazo SLA</span>
                          <span className="font-extrabold text-amber-600 dark:text-amber-400 text-sm">{catSla} horas</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-extrabold block">Intervalo Lembretes</span>
                          <span className="font-extrabold text-slate-700 dark:text-slate-200 text-sm">a cada {catInterval}h</span>
                        </div>
                      </div>

                      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>OS ativas nesta categoria:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{activeCountForCat}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatSla(cat);
                        setCatSlaHoursInput(catSla);
                        setCatReminderIntervalInput(catInterval);
                        setCatReminderEnabledInput(catEnabled);
                        setCatNotifyGestorInput(cat.notifyGestor !== false);
                        setCatNotifyTechInput(cat.notifyTechnician !== false);
                      }}
                      className="w-full py-1.5 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Configurar SLA & Disparos</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: LIVE MONITORING OF ACTIVE SERVICE ORDERS */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Hourglass className="w-5 h-5 text-indigo-600" />
                  <span>Ordens de Serviço em Aberto / Em Progresso (Monitoramento de SLA)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Status em tempo real das OS ativas, tempo restante e envio manual de cobrança para o técnico.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar OS, categoria ou técnico..."
                    value={slaSearchTerm}
                    onChange={(e) => setSlaSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-amber-500 w-48 sm:w-64"
                  />
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                  <button
                    onClick={() => setSlaFilter('all')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${slaFilter === 'all' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'}`}
                  >
                    Todas ({activeMonitoredOrders.length})
                  </button>
                  <button
                    onClick={() => setSlaFilter('em_dia')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${slaFilter === 'em_dia' ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-500'}`}
                  >
                    Em dia ({healthySlaCount})
                  </button>
                  <button
                    onClick={() => setSlaFilter('vencendo_logo')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${slaFilter === 'vencendo_logo' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500'}`}
                  >
                    Vencendo ({expiringSoonSlaCount})
                  </button>
                  <button
                    onClick={() => setSlaFilter('vencido')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${slaFilter === 'vencido' ? 'bg-red-500 text-white shadow-xs' : 'text-slate-500'}`}
                  >
                    Vencidas ({overdueSlaCount})
                  </button>
                </div>
              </div>
            </div>

            {/* List of OS under SLA tracking */}
            {(() => {
              const filteredSlaInfos = monitoredSlaInfos.filter(info => {
                if (slaFilter !== 'all' && info.status !== slaFilter) return false;
                if (slaSearchTerm.trim()) {
                  const q = slaSearchTerm.toLowerCase();
                  return info.osId.toLowerCase().includes(q) ||
                    info.osTitle.toLowerCase().includes(q) ||
                    info.categoryName.toLowerCase().includes(q) ||
                    info.assignedTo.toLowerCase().includes(q);
                }
                return true;
              });

              if (filteredSlaInfos.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    <CheckCircle className="w-10 h-10 mx-auto text-emerald-500" />
                    <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Nenhuma Ordem de Serviço encontrada para o filtro selecionado.</p>
                    <p className="text-xs text-slate-400">Todas as ordens de serviço ativas estão com o SLA em dia!</p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase font-black text-[10px] tracking-wider">
                        <th className="py-3 px-3">OS / Título</th>
                        <th className="py-3 px-3">Categoria</th>
                        <th className="py-3 px-3">Status OS</th>
                        <th className="py-3 px-3">Técnico Atribuído</th>
                        <th className="py-3 px-3">Prazo SLA / Expiração</th>
                        <th className="py-3 px-3">Progresso SLA</th>
                        <th className="py-3 px-3 text-right">Ação de Cobrança</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {filteredSlaInfos.map(info => {
                        const matchedOS = orders.find(o => o.id === info.osId);
                        if (!matchedOS) return null;

                        return (
                          <tr key={info.osId} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="py-3 px-3 font-bold text-slate-800 dark:text-white">
                              <div>#{info.osId}</div>
                              <div className="text-xs font-normal text-slate-500 line-clamp-1">{info.osTitle}</div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{info.categoryName}</span>
                              <span className="block text-[10px] text-slate-400">SLA: {info.slaHours}h</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                matchedOS.status === 'aberto' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}>
                                {matchedOS.status === 'aberto' ? 'Aberto' : 'Em Progresso'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                              {info.assignedTo}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold">{info.deadlineFormatted}</div>
                              <div className={`text-[11px] font-black ${
                                info.status === 'vencido' ? 'text-red-600 dark:text-red-400' :
                                info.status === 'vencendo_logo' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {info.formattedRemaining}
                              </div>
                            </td>
                            <td className="py-3 px-3 w-36">
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      info.status === 'vencido' ? 'bg-red-500' :
                                      info.status === 'vencendo_logo' ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${info.percentageElapsed}%` }}
                                  ></div>
                                </div>
                                <span className="text-[10px] font-extrabold text-slate-500">{info.percentageElapsed}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onAddNotification) {
                                    triggerManualSlaReminder(matchedOS, categories, onAddNotification, onAddSystemLog);
                                    loadSlaLogs();
                                    toastSuccess(`Lembrete de cobrança de SLA enviado com sucesso para ${info.assignedTo}!`, "Lembrete Disparado");
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-xs inline-flex items-center gap-1 cursor-pointer"
                              >
                                <BellRing className="w-3.5 h-3.5" />
                                <span>Cobrar Técnico</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* SECTION 3: RECENT AUTOMATIC REMINDER DISPATCH LOGS */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-500" />
                  <span>Histórico de Lembretes de SLA Disparados pelo Sistema</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Registro de auditoria dos alertas de vencimento e cobranças enviadas para a equipe.
                </p>
              </div>

              <button
                type="button"
                onClick={loadSlaLogs}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar Histórico</span>
              </button>
            </div>

            {slaLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum disparo de lembrete de SLA registrado recentemente.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {slaLogs.map(log => (
                  <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          log.reminderType === 'expired' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' :
                          log.reminderType === 'warning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}>
                          {log.reminderType === 'expired' ? 'SLA Expirado' : log.reminderType === 'warning' ? 'Aviso Vencimento' : 'Cobrança Manual'}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-white">OS #{log.osId} - {log.osTitle}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px]">{log.message}</p>
                    </div>

                    <div className="text-right text-[11px] text-slate-400 shrink-0">
                      <div>{new Date(log.sentAt).toLocaleString("pt-BR")}</div>
                      <div className="font-semibold text-slate-600 dark:text-slate-300">Para: {log.recipientName}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* EDIT CATEGORY SLA MODAL */}
          {editingCatSla && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                    <Timer className="w-5 h-5 text-amber-500" />
                    <span>SLA: {editingCatSla.name}</span>
                  </h3>
                  <button
                    onClick={() => setEditingCatSla(null)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Prazo do SLA da Categoria (em horas)</label>
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={catSlaHoursInput}
                      onChange={(e) => setCatSlaHoursInput(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-white font-bold"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Ex: 24 horas (1 dia), 48 horas (2 dias), 72 horas (3 dias).
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Intervalo de Reenvio de Lembretes (em horas)</label>
                    <input
                      type="number"
                      min="1"
                      max="48"
                      value={catReminderIntervalInput}
                      onChange={(e) => setCatReminderIntervalInput(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-white font-bold"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Frequência em que os lembretes automáticos de cobrança serão reenviados após o vencimento.
                    </span>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={catReminderEnabledInput}
                        onChange={(e) => setCatReminderEnabledInput(e.target.checked)}
                        className="rounded-md text-amber-600 focus:ring-amber-500 w-4 h-4"
                      />
                      <span className="font-bold text-slate-800 dark:text-white">Ativar Lembretes Automáticos para esta Categoria</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer pl-6">
                      <input
                        type="checkbox"
                        checked={catNotifyGestorInput}
                        onChange={(e) => setCatNotifyGestorInput(e.target.checked)}
                        className="rounded-md text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                      />
                      <span className="text-slate-600 dark:text-slate-300">Notificar Gestores quando SLA expirar</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer pl-6">
                      <input
                        type="checkbox"
                        checked={catNotifyTechInput}
                        onChange={(e) => setCatNotifyTechInput(e.target.checked)}
                        className="rounded-md text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                      />
                      <span className="text-slate-600 dark:text-slate-300">Notificar Técnico responsável pela OS</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setEditingCatSla(null)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateCategory && editingCatSla) {
                        onUpdateCategory({
                          ...editingCatSla,
                          slaHours: catSlaHoursInput,
                          reminderIntervalHours: catReminderIntervalInput,
                          reminderEnabled: catReminderEnabledInput,
                          notifyGestor: catNotifyGestorInput,
                          notifyTechnician: catNotifyTechInput
                        });
                        toastSuccess(`Configurações de SLA para "${editingCatSla.name}" salvas com sucesso!`, "SLA Atualizado");
                        setEditingCatSla(null);
                      }
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Salvar Alterações de SLA</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TRAVEL REMINDERS TAB VIEW */}
      {viewMode === "travel_reminders" && (
        <div className="space-y-6">
          {/* Top Status & Browser Notification Permission Banner */}
          <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-lg border border-emerald-800/40 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Navigation className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                    Lembretes Automáticos de Deslocamento Técnico
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold uppercase px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Notificações do Navegador & In-App
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300 font-medium">
                    Configure os horários de saída previstos para cada Ordem de Serviço, considerando o tempo estimado de deslocamento e margem de antecedência.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Browser Permission Request Button */}
                {notificationPermission === "granted" ? (
                  <div className="flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-3 py-2 rounded-xl text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Notificações do Navegador Ativas</span>
                  </div>
                ) : (
                  <button
                    onClick={handleRequestNotificationPermission}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Bell className="w-4 h-4" />
                    <span>Ativar Permissão de Notificação Push</span>
                  </button>
                )}

                {/* Test Notification Trigger */}
                <button
                  onClick={handleTestNotification}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Testar alerta sonoro e notificação push"
                >
                  <Volume2 className="w-4 h-4 text-amber-300" />
                  <span>Testar Alerta (Som & Push)</span>
                </button>
              </div>
            </div>

            {/* Quick stats & instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                <span className="text-[10px] font-black uppercase text-emerald-400 block mb-0.5">Lembretes Ativos</span>
                <span className="text-xl font-extrabold">{travelReminders.filter(r => r.status === "active").length}</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Monitorados em tempo real</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                <span className="text-[10px] font-black uppercase text-indigo-400 block mb-0.5">Canais de Disparo</span>
                <span className="font-bold text-slate-200">Browser Push + Som In-App</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Alerta duplo de segurança</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                <span className="text-[10px] font-black uppercase text-amber-400 block mb-0.5">Cálculo de Deslocamento</span>
                <span className="font-bold text-slate-200">Horário Atendimento - (Viagem + Margem)</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Garante pontualidade com o cliente</p>
              </div>
            </div>
          </div>

          {/* Form & Active Reminders Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Create/Edit Travel Reminder Form */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  {editingReminderId ? "Editar Lembrete de Deslocamento" : "Novo Lembrete de Deslocamento"}
                </h3>
                {editingReminderId && (
                  <button
                    onClick={() => {
                      setEditingReminderId(null);
                      setReminderNotes("");
                    }}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    Cancelar Edição
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveReminder} className="space-y-3">
                {/* Select OS */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Ordem de Serviço
                  </label>
                  <select
                    value={reminderOrderId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setReminderOrderId(id);
                      const o = orders.find(ord => ord.id === id);
                      if (o) {
                        setReminderScheduledDate(o.startDate || selectedDateStr);
                        if (o.assignedTo) setReminderTechName(o.assignedTo);
                      }
                    }}
                    className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                  >
                    {orders.map(o => {
                      const client = clients.find(c => c.id === o.clientId);
                      return (
                        <option key={o.id} value={o.id}>
                          #{o.id} - {o.title} ({client?.name || "Cliente"})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Technician Name */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Técnico Responsável
                  </label>
                  <select
                    value={reminderTechName}
                    onChange={(e) => setReminderTechName(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                  >
                    {professionalsList
                      .filter(p => !p.userType || p.userType === "profissional")
                      .map(p => (
                        <option key={p.id} value={p.name}>
                          🔧 {p.name}
                        </option>
                      ))
                    }
                    {currentUser && <option value={currentUser.name}>👤 {currentUser.name} (Atual)</option>}
                  </select>
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Data Atendimento
                    </label>
                    <input
                      type="date"
                      required
                      value={reminderScheduledDate}
                      onChange={(e) => setReminderScheduledDate(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Horário Marcado
                    </label>
                    <input
                      type="time"
                      required
                      value={reminderScheduledTime}
                      onChange={(e) => setReminderScheduledTime(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none"
                    />
                  </div>
                </div>

                {/* Travel time & Lead time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Tempo Deslocamento
                    </label>
                    <select
                      value={reminderTravelMins}
                      onChange={(e) => setReminderTravelMins(Number(e.target.value))}
                      className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                    >
                      <option value={15}>15 minutos</option>
                      <option value={20}>20 minutos</option>
                      <option value={30}>30 minutos</option>
                      <option value={45}>45 minutos</option>
                      <option value={60}>60 minutos (1h)</option>
                      <option value={90}>90 minutos (1h30)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Aviso Antecipado
                    </label>
                    <select
                      value={reminderLeadMins}
                      onChange={(e) => setReminderLeadMins(Number(e.target.value))}
                      className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                    >
                      <option value={5}>5 min antes de sair</option>
                      <option value={10}>10 min antes de sair</option>
                      <option value={15}>15 min antes de sair</option>
                      <option value={20}>20 min antes de sair</option>
                    </select>
                  </div>
                </div>

                {/* Transport Mode */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Meio de Transporte
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReminderTransportMode("car")}
                      className={`py-2 px-1 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                        reminderTransportMode === "car"
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <Car className="w-4 h-4" />
                      <span>Carro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderTransportMode("motorcycle")}
                      className={`py-2 px-1 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                        reminderTransportMode === "motorcycle"
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <Bike className="w-4 h-4" />
                      <span>Moto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderTransportMode("transit")}
                      className={`py-2 px-1 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                        reminderTransportMode === "transit"
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <Bus className="w-4 h-4" />
                      <span>Ônibus</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderTransportMode("walking")}
                      className={`py-2 px-1 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                        reminderTransportMode === "walking"
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <Footprints className="w-4 h-4" />
                      <span>A pé</span>
                    </button>
                  </div>
                </div>

                {/* Notes / Route instructions */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Instruções de Rota / Peças a Carregar
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Pegar multímetro e peças no almoxarifado antes de ir"
                    value={reminderNotes}
                    onChange={(e) => setReminderNotes(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>

                {/* Notification Channel Toggles */}
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800 rounded-xl space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                    Canais de Notificação
                  </span>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reminderNotifyBrowser}
                        onChange={(e) => setReminderNotifyBrowser(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Push Navegador</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reminderNotifyInApp}
                        onChange={(e) => setReminderNotifyInApp(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Alerta Sonoro In-App</span>
                    </label>
                  </div>
                </div>

                {/* Calculated Departure Box */}
                <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-black uppercase text-emerald-400 block">Horário Recomendado de Saída</span>
                    <span className="text-sm font-extrabold font-mono">
                      {calculateDepartureTimeStr(reminderScheduledDate, reminderScheduledTime, reminderTravelMins, reminderLeadMins)}
                    </span>
                  </div>
                  <Navigation className="w-5 h-5 text-emerald-400 animate-bounce" />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {editingReminderId ? "Salvar Alterações do Lembrete" : "Cadastrar Lembrete de Deslocamento"}
                </button>
              </form>
            </div>

            {/* List of Configured Travel Reminders */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl">
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Lembretes Programados ({travelReminders.length})
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">O sistema disparará alertas automaticamente quando o horário de saída for atingido.</p>
                </div>

                {/* Filter buttons */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 text-[10px] font-bold">
                  <button
                    onClick={() => setReminderStatusFilter("all")}
                    className={`px-2.5 py-1 rounded-lg transition-all ${reminderStatusFilter === "all" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-slate-500"}`}
                  >
                    Todos ({travelReminders.length})
                  </button>
                  <button
                    onClick={() => setReminderStatusFilter("active")}
                    className={`px-2.5 py-1 rounded-lg transition-all ${reminderStatusFilter === "active" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500"}`}
                  >
                    Ativos ({travelReminders.filter(r => r.status === "active").length})
                  </button>
                  <button
                    onClick={() => setReminderStatusFilter("notified")}
                    className={`px-2.5 py-1 rounded-lg transition-all ${reminderStatusFilter === "notified" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500"}`}
                  >
                    Disparados ({travelReminders.filter(r => r.status === "notified").length})
                  </button>
                </div>
              </div>

              {/* Reminders Grid */}
              {travelReminders.length > 0 ? (
                <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                  {travelReminders
                    .filter(r => reminderStatusFilter === "all" || r.status === reminderStatusFilter)
                    .map((rem) => {
                      const matchedOS = orders.find(o => o.id === rem.orderId);
                      const client = matchedOS ? clients.find(c => c.id === matchedOS.clientId) : null;

                      return (
                        <div
                          key={rem.id}
                          className={`p-4 rounded-2xl border transition-all space-y-3 ${
                            rem.status === "active"
                              ? "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-500 shadow-sm"
                              : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-75"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                                  OS #{rem.orderId}
                                </span>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                  rem.status === "active"
                                    ? "bg-emerald-500 text-white"
                                    : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}>
                                  {rem.status === "active" ? "🚨 Monitorando Saída" : "✅ Alerta Disparado"}
                                </span>
                              </div>
                              <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 leading-snug">
                                {matchedOS?.title || `Ordem de Serviço #${rem.orderId}`}
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Cliente: <strong>{client?.name || "Cliente Araçatuba"}</strong> • Técnico: <strong>{rem.technicianName}</strong>
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditReminder(rem)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors cursor-pointer"
                                title="Editar Lembrete"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteReminder(rem.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                                title="Excluir Lembrete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Departure timing breakdown */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-150 dark:border-slate-800 text-xs">
                            <div>
                              <span className="text-[9px] font-black uppercase text-slate-400 block">Horário Marcado</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200">{rem.scheduledDate} às {rem.scheduledTime}</span>
                            </div>

                            <div>
                              <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 block">Horário de Saída</span>
                              <span className="font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">{rem.calculatedDepartureTime}</span>
                            </div>

                            <div>
                              <span className="text-[9px] font-black uppercase text-slate-400 block">Transporte & Viagem</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                                {rem.transportMode === "car" && <Car className="w-3.5 h-3.5 text-emerald-500" />}
                                {rem.transportMode === "motorcycle" && <Bike className="w-3.5 h-3.5 text-emerald-500" />}
                                {rem.transportMode === "transit" && <Bus className="w-3.5 h-3.5 text-emerald-500" />}
                                {rem.transportMode === "walking" && <Footprints className="w-3.5 h-3.5 text-emerald-500" />}
                                {rem.travelTimeMinutes} min (+{rem.leadTimeMinutes}m margem)
                              </span>
                            </div>
                          </div>

                          {rem.notes && (
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-100 dark:border-amber-900/50 italic">
                              💡 {rem.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                  <Navigation className="w-8 h-8 text-slate-300 mb-1.5" />
                  <p className="font-bold text-xs">Nenhum lembrete de deslocamento programado</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Utilize o formulário ao lado para cadastrar avisos de saída antecipada.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Calendar visual column */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          {/* Calendar Controller Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <span className="font-extrabold text-base text-slate-800 tracking-tight flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${viewMode === "blocked_calendar" ? "bg-indigo-600" : "bg-emerald-500"}`}></span>
              {monthNames[month]} de {year}
            </span>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGoToToday}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="Voltar para a data de hoje"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Hoje</span>
              </button>

              <div className="flex bg-slate-50 border border-slate-200/55 rounded-xl p-1 gap-0.5">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 px-2.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all font-semibold cursor-pointer"
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1 px-2.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all font-semibold cursor-pointer"
                  title="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Intuitively integrated filter bar for the Holidays/Days Off calendar view */}
          {viewMode === "blocked_calendar" && (
            <div className="mb-6 p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-750 block">Filtros do Calendário</span>
                  <p className="text-[10px] text-slate-500 font-medium">Selecione o tipo de bloqueio ou filtre por técnico.</p>
                </div>
                <span className="text-[10px] text-indigo-700 font-extrabold bg-indigo-100/70 border border-indigo-200/60 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                  {currentMonthBlocks.length} {currentMonthBlocks.length === 1 ? "registro" : "registros"}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Type Filter */}
                <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setBlockFilterType("all")}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                      blockFilterType === "all"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBlockFilterType("holiday");
                      setBlockFilterProf("all");
                    }}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                      blockFilterType === "holiday"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    Feriados
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlockFilterType("day_off")}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                      blockFilterType === "day_off"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    Folgas
                  </button>
                </div>

                {/* Professional Filter (only relevant if type is not strictly holidays) */}
                <div className="flex items-center gap-1.5">
                  <select
                    disabled={blockFilterType === "holiday"}
                    value={blockFilterProf}
                    onChange={(e) => setBlockFilterProf(e.target.value)}
                    className="w-full text-[10px] font-extrabold uppercase tracking-wider border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 outline-none disabled:opacity-50 disabled:bg-slate-50 cursor-pointer"
                  >
                    <option value="all">👥 Todos os Técnicos</option>
                    {professionalsList
                      .filter(p => !p.userType || p.userType === "profissional")
                      .map(p => (
                        <option key={p.id} value={p.name}>
                          🔧 {p.name}
                        </option>
                      ))
                    }
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Calendar grid titles */}
          <div className="grid grid-cols-7 text-center text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          {/* Calendar dynamic days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarGrid.map((day, idx) => {
              if (day === null) {
                return <div key={idx} className="aspect-square bg-slate-50/20 rounded-xl" />;
              }

              const fullDateStr = getFormattedDateString(day);
              const dayOrders = getOrdersForDate(fullDateStr);
              const isSelected = selectedDateStr === fullDateStr;
              
              // Highlight today if matching current local computer date
              const isToday = fullDateStr === getLocalTodayDateStr();

              // Find active blocks on this date
              const dayBlocks = blockedDates.filter(b => b.date === fullDateStr);
              
              // Apply active filters if we are in blocked_calendar view mode
              const filteredDayBlocks = dayBlocks.filter(b => {
                if (viewMode === "blocked_calendar") {
                  if (blockFilterType === "holiday" && b.type !== "holiday") return false;
                  if (blockFilterType === "day_off" && b.type !== "day_off") return false;
                  if (blockFilterProf !== "all" && b.type === "day_off" && b.professionalId !== blockFilterProf) return false;
                }
                return true;
              });

              const hasHoliday = filteredDayBlocks.some(b => b.type === "holiday");
              const hasDayOff = filteredDayBlocks.some(b => b.type === "day_off");
              const isBlockedDay = filteredDayBlocks.length > 0;

              // Define custom style pairings depending on current view mode
              let dayBgStyle = "bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200 text-slate-700";
              let textStyle = "text-slate-750";

              if (isSelected) {
                dayBgStyle = viewMode === "blocked_calendar"
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-950/10";
                textStyle = "text-white";
              } else if (isToday) {
                dayBgStyle = "bg-emerald-50 border-emerald-200 text-emerald-800 font-extrabold";
                textStyle = "text-emerald-800";
              } else if (viewMode === "blocked_calendar") {
                // Specialized block highlighting mode
                if (hasHoliday) {
                  dayBgStyle = "bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100/80 shadow-xs";
                  textStyle = "text-rose-700 font-extrabold";
                } else if (hasDayOff) {
                  dayBgStyle = "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100/80 shadow-xs";
                  textStyle = "text-amber-800 font-extrabold";
                } else {
                  // Mute normal days to make unavailability stand out immediately!
                  dayBgStyle = "bg-slate-50/50 hover:bg-slate-100/60 border-slate-150/40 text-slate-400";
                  textStyle = "text-slate-400/80 font-medium";
                }
              } else {
                // General style
                if (hasHoliday) {
                  dayBgStyle = "bg-rose-50/70 border-rose-200 text-rose-900 hover:bg-rose-100/50";
                  textStyle = "text-rose-700";
                } else if (hasDayOff) {
                  dayBgStyle = "bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100/50";
                  textStyle = "text-amber-800";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDateStr(fullDateStr)}
                  className={`relative group aspect-square rounded-xl p-1.5 flex flex-col justify-between items-stretch border transition-all text-left cursor-pointer ${dayBgStyle}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[11px] font-bold ${textStyle}`}>
                      {day}
                    </span>
                    {isBlockedDay && !isSelected && (
                      <span className={`text-[9px] ${hasHoliday ? "text-rose-600" : "text-amber-600"}`} title={filteredDayBlocks.map(b => b.description).join(", ")}>
                        <Lock className="w-2.5 h-2.5 shrink-0" />
                      </span>
                    )}
                  </div>

                  {/* Render service order indicator dots (muted in blocked mode) */}
                  {dayOrders.length > 0 && (
                    <div className="flex gap-0.5 mt-auto flex-wrap">
                      {dayOrders.slice(0, 3).map((order) => (
                        <span
                          key={order.id}
                          className={`w-1.5 h-1.5 rounded-full ${
                            order.status === "concluido" ? "bg-green-400" :
                            order.status === "em_progresso" ? "bg-blue-400" :
                            order.status === "aguardando" ? "bg-orange-400" : "bg-slate-300"
                          }`}
                          title={`${order.id}: ${order.title}`}
                        />
                      ))}
                      {dayOrders.length > 3 && (
                        <span className="text-[7px] font-extrabold opacity-60 leading-none">+{dayOrders.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Beautiful Tooltip on Hover for Blocked Days */}
                  {isBlockedDay && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-52 bg-slate-900 text-white text-[10px] rounded-xl p-3 shadow-xl border border-slate-800 z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 scale-90 origin-bottom group-hover:scale-100">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                          <Lock className={`w-3.5 h-3.5 ${hasHoliday ? "text-rose-400" : "text-amber-400"}`} />
                          <span className={`font-black uppercase tracking-wider text-[8px] ${hasHoliday ? "text-rose-400" : "text-amber-400"}`}>
                            {hasHoliday ? "Feriado / Bloqueio" : "Folga do Técnico"}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {filteredDayBlocks.map((b) => (
                            <div key={b.id} className="space-y-0.5 text-left">
                              <p className="font-bold text-slate-100 leading-snug">{b.description}</p>
                              {b.type === "day_off" && b.professionalId && (
                                <p className="text-amber-300 font-extrabold text-[9px] flex items-center gap-1">
                                  <span>🔧</span>
                                  <span>{b.professionalId}</span>
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Tooltip triangle arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details Column */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm self-stretch flex flex-col justify-between min-h-[440px]">
          <div>
            {/* Header Title depending on Mode */}
            {viewMode === "blocked_calendar" ? (
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-4">
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-700">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Feriados & Folgas do Dia</h3>
                  <p className="text-xs text-slate-500 font-medium">Dia {new Date(selectedDateStr + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-4">
                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Atendimentos no Dia</h3>
                  <p className="text-xs text-slate-500 font-medium">Dia {new Date(selectedDateStr + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            )}

            {/* Blocked Dates (Holidays/Days off) details/alerts */}
            {(() => {
              const selectedDateBlocks = blockedDates.filter(b => b.date === selectedDateStr);
              if (selectedDateBlocks.length === 0) {
                if (viewMode === "blocked_calendar") {
                  return (
                    <div className="py-6 px-4 mb-4 text-center border border-dashed border-slate-150 rounded-xl bg-slate-50/20 text-slate-400 flex flex-col items-center justify-center">
                      <CheckCircle className="w-7 h-7 text-slate-350 mb-1" />
                      <p className="font-bold text-[11px] text-slate-700">Data Livre / Disponível</p>
                      <p className="text-[10px] text-slate-450 mt-0.5">Nenhum feriado ou folga cadastrada nesta data.</p>
                    </div>
                  );
                }
                return null;
              }
              return (
                <div className="space-y-2 mb-4">
                  {selectedDateBlocks.map((block) => (
                    <div 
                      key={block.id} 
                      className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                        block.type === "holiday" 
                          ? "bg-rose-50/70 border-rose-150 text-rose-950" 
                          : "bg-amber-50/70 border-amber-150 text-amber-955"
                      }`}
                    >
                      <Lock className={`w-4 h-4 shrink-0 mt-0.5 ${block.type === "holiday" ? "text-rose-500" : "text-amber-500"}`} />
                      <div className="text-xs">
                        <span className="font-extrabold uppercase tracking-wider block text-[9px] opacity-80">
                          {block.type === "holiday" ? "🚨 Feriado / Data Bloqueada" : "🔒 Dia de Folga Técnico"}
                        </span>
                        <p className="font-bold mt-0.5">{block.description}</p>
                        {block.type === "day_off" && block.professionalId !== "all" && (
                          <p className="text-[10px] text-amber-800 font-extrabold mt-0.5">Técnico dispensado: {block.professionalId}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Interactive Conflict alert inside blocked_calendar mode */}
            {viewMode === "blocked_calendar" && selectedDayOrders.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-950 text-xs mb-4 space-y-1">
                <div className="flex items-center gap-1.5 font-bold uppercase text-[9px] text-red-700">
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                  <span>Conflito de Escala!</span>
                </div>
                <p className="font-semibold text-[11px] leading-snug">Existem {selectedDayOrders.length} ordens de serviço ativas no dia desse bloqueio técnico ou geral.</p>
              </div>
            )}

            {/* Services scheduled */}
            {viewMode === "general" ? (
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[280px] pr-1">
                {selectedDayOrders.length > 0 ? (
                  selectedDayOrders.map((os) => (
                    <div key={os.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200/50 hover:border-slate-300 duration-150 relative">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold font-mono text-slate-400 uppercase">{os.id}</span>
                        <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          os.status === "concluido" ? "bg-green-100 text-green-800" :
                          os.status === "em_progresso" ? "bg-blue-100 text-blue-800" :
                          os.status === "aguardando" ? "bg-orange-100 text-orange-850" : "bg-slate-200 text-slate-650"
                        }`}>
                          {os.status === "concluido" ? "Concluído" :
                           os.status === "em_progresso" ? "Em Execução" :
                           os.status === "aguardando" ? "Aguardando Peças" :
                           os.status === "aberto" ? "Aberto" : "Cancelado"}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-850 text-xs leading-snug">{os.title}</h4>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">Requisitante: {getClientName(os.clientId)}</p>

                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-3.5 pt-2 border-t border-slate-200/40">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-350" />
                          <span>{os.startDate === selectedDateStr ? "ENTRADA / INÍCIO" : "PRAZO ENTREGA"}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenReminderForOS(os)}
                        className="mt-2.5 w-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold py-1.5 px-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Navigation className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Configurar Lembrete de Deslocamento</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl">
                    <CheckCircle className="w-8 h-8 text-slate-300 mb-1.5" />
                    <p className="font-bold text-xs">Agenda livre nesta data!</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Nenhum atendimento ou prazo agendado.</p>
                  </div>
                )}
              </div>
            ) : (
              /* In Blocked mode: Render the Chronological Timeline of the selected month so users can see holidays/days off in order */
              <div className="mt-2 flex-1 flex flex-col min-h-[180px]">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2.5">Linha do Tempo do Mês ({monthNames[month]})</span>
                
                {currentMonthBlocks.length > 0 ? (
                  <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1">
                    {currentMonthBlocks.map((block) => {
                      const blockDay = block.date.split("-")[2];
                      const isSelectedBlock = selectedDateStr === block.date;
                      
                      return (
                        <button
                          type="button"
                          key={block.id}
                          onClick={() => setSelectedDateStr(block.date)}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                            isSelectedBlock
                              ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                              : block.type === "holiday"
                              ? "bg-rose-50/45 border-rose-100 hover:bg-rose-50/80 text-rose-955"
                              : "bg-amber-50/45 border-amber-100 hover:bg-amber-50/80 text-amber-955"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                              isSelectedBlock 
                                ? "bg-white/15 text-white" 
                                : block.type === "holiday" 
                                ? "bg-rose-100 text-rose-700 border border-rose-200/50" 
                                : "bg-amber-100 text-amber-800 border border-amber-200/50"
                            }`}>
                              {blockDay}
                            </span>
                            <div className="min-w-0 text-xs">
                              <p className="font-bold truncate leading-snug">{block.description}</p>
                              <span className={`text-[8px] font-black uppercase tracking-wide ${
                                isSelectedBlock 
                                  ? "text-indigo-300" 
                                  : block.type === "holiday" 
                                  ? "text-rose-600" 
                                  : "text-amber-700"
                              }`}>
                                {block.type === "holiday" ? "Feriado Geral" : `Folga: ${block.professionalId}`}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${isSelectedBlock ? "text-white translate-x-0.5" : "text-slate-350"}`} />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center border border-dashed border-slate-150 rounded-xl bg-slate-50/20">
                    <HelpCircle className="w-8 h-8 text-slate-350 mb-1.5" />
                    <p className="font-bold text-[11px] text-slate-500">Sem registros neste mês</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Use os filtros acima ou navegue entre os meses.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick schedule dispatch callback (only in General calendar mode) */}
          {onQuickScheduleOrder && viewMode === "general" && (
            <button
              onClick={() => onQuickScheduleOrder(selectedDateStr)}
              className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-xl shadow-lg shadow-slate-950/5 active:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              Propor OS nesta Data
            </button>
          )}
        </div>
      </div>

      {/* Holiday and Day-Off Management Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6 mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Gestão de Feriados & Folgas</h3>
              <p className="text-xs text-slate-500 font-medium">Cadastre feriados gerais ou folgas de técnicos para bloquear a alocação de serviços em datas específicas.</p>
            </div>
          </div>
          {onAddBlockedDate && (
            <span className="text-[10px] bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold uppercase px-2.5 py-1 rounded-lg">
              Painel do Gestor Ativo
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Create blocked date form (only for managers/admins) */}
          {onAddBlockedDate && (
            <div className="lg:col-span-5 bg-slate-50/50 border border-slate-200/50 rounded-2xl p-5 space-y-4">
              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Bloquear Nova Data
              </h4>
              
              <form onSubmit={handleCreateBlock} className="space-y-3">
                {blockError && (
                  <p className="text-[11px] text-red-600 font-bold bg-red-50 border border-red-150 p-2 rounded-xl">
                    ⚠️ {blockError}
                  </p>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo de Bloqueio</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewBlockType("holiday");
                        setNewBlockProfId("all");
                      }}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all text-center ${
                        newBlockType === "holiday"
                          ? "bg-slate-900 border-slate-900 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Feriado Geral
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewBlockType("day_off");
                        if (professionalsList.length > 0) {
                          const onlyProfs = professionalsList.filter(p => !p.userType || p.userType === "profissional");
                          if (onlyProfs.length > 0) {
                            setNewBlockProfId(onlyProfs[0].name);
                          } else {
                            setNewBlockProfId(professionalsList[0].name);
                          }
                        }
                      }}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all text-center ${
                        newBlockType === "day_off"
                          ? "bg-slate-900 border-slate-900 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Folga de Técnico
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Selecionar Data</label>
                    <input
                      type="date"
                      required
                      value={newBlockDate}
                      onChange={(e) => setNewBlockDate(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 outline-none"
                    />
                  </div>

                  {newBlockType === "day_off" && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Selecionar Técnico</label>
                      <select
                        value={newBlockProfId}
                        onChange={(e) => setNewBlockProfId(e.target.value)}
                        className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 outline-none"
                      >
                        {professionalsList
                          .filter(p => !p.userType || p.userType === "profissional")
                          .map(p => (
                            <option key={p.id} value={p.name}>
                              {p.name}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Descrição / Motivo</label>
                  <input
                    type="text"
                    required
                    placeholder={newBlockType === "holiday" ? "Ex: Padroeiro Municipal de Araçatuba" : "Ex: Folga compensatória pós plantão"}
                    value={newBlockDescription}
                    onChange={(e) => setNewBlockDescription(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Salvar Bloqueio
                </button>
              </form>
            </div>
          )}

          {/* List of currently blocked dates */}
          <div className={`${onAddBlockedDate ? "lg:col-span-7" : "lg:col-span-12"} space-y-3`}>
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 mb-4">
              <CalendarIcon className="w-4 h-4 text-slate-500" />
              Bloqueios Cadastrados ({blockedDates.length})
            </h4>

            {blockedDates.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                {blockedDates.map((block) => {
                  const blockDateFormatted = new Date(block.date + "T12:00:00").toLocaleDateString("pt-BR");
                  return (
                    <div 
                      key={block.id} 
                      className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 transition-all ${
                        block.type === "holiday" 
                          ? "bg-red-50/30 border-red-150 hover:bg-red-50/50 text-red-955" 
                          : "bg-amber-50/30 border-amber-150 hover:bg-amber-50/50 text-amber-955"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                            block.type === "holiday" 
                              ? "bg-red-100 border border-red-200 text-red-700" 
                              : "bg-amber-100 border border-amber-200 text-amber-800"
                          }`}>
                            {block.type === "holiday" ? "Feriado Geral" : "Folga de Técnico"}
                          </span>
                          <span className="font-bold text-[10px] text-slate-500">{blockDateFormatted}</span>
                        </div>
                        <p className="font-extrabold text-xs text-slate-800">{block.description}</p>
                        {block.type === "day_off" && block.professionalId !== "all" && (
                          <p className="text-[10px] text-amber-700 font-semibold">Técnico: {block.professionalId}</p>
                        )}
                      </div>

                      {onDeleteBlockedDate && (
                        <button
                          onClick={() => onDeleteBlockedDate(block.id)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1 hover:bg-white/60 rounded-lg shrink-0"
                          title="Remover bloqueio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/20">
                <CheckCircle className="w-8 h-8 text-slate-300 mb-1.5" />
                <p className="font-bold text-xs">Nenhum dia de folga ou feriado bloqueado!</p>
                <p className="text-[10px] text-slate-400 mt-0.5">O calendário técnico opera em fluxo integral contínuo.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: Quick Travel Reminder Setup Dialog */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
            <button
              onClick={() => setIsReminderModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-2xl">
                <Navigation className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
                  Configurar Lembrete de Deslocamento
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {selectedOSForReminder ? `Ordem de Serviço #${selectedOSForReminder.id} - ${selectedOSForReminder.title}` : "Aviso de saída antecipada para atendimento"}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveReminder} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Data Atendimento
                  </label>
                  <input
                    type="date"
                    required
                    value={reminderScheduledDate}
                    onChange={(e) => setReminderScheduledDate(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Horário Marcado
                  </label>
                  <input
                    type="time"
                    required
                    value={reminderScheduledTime}
                    onChange={(e) => setReminderScheduledTime(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Tempo Est. Viagem
                  </label>
                  <select
                    value={reminderTravelMins}
                    onChange={(e) => setReminderTravelMins(Number(e.target.value))}
                    className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                  >
                    <option value={15}>15 minutos</option>
                    <option value={20}>20 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={45}>45 minutos</option>
                    <option value={60}>60 minutos (1h)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Margem Antecedência
                  </label>
                  <select
                    value={reminderLeadMins}
                    onChange={(e) => setReminderLeadMins(Number(e.target.value))}
                    className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                  >
                    <option value={5}>5 min antes</option>
                    <option value={10}>10 min antes</option>
                    <option value={15}>15 min antes</option>
                    <option value={20}>20 min antes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Meio de Transporte
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setReminderTransportMode("car")}
                    className={`py-2 px-1 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                      reminderTransportMode === "car"
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Car className="w-4 h-4" />
                    <span>Carro</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReminderTransportMode("motorcycle")}
                    className={`py-2 px-1 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                      reminderTransportMode === "motorcycle"
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Bike className="w-4 h-4" />
                    <span>Moto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReminderTransportMode("transit")}
                    className={`py-2 px-1 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                      reminderTransportMode === "transit"
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Bus className="w-4 h-4" />
                    <span>Ônibus</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReminderTransportMode("walking")}
                    className={`py-2 px-1 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                      reminderTransportMode === "walking"
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Footprints className="w-4 h-4" />
                    <span>A pé</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Observações de Deslocamento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Pegar kit de ferramentas e peças de reposição"
                  value={reminderNotes}
                  onChange={(e) => setReminderNotes(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase text-emerald-400 block">Horário Estimado de Saída</span>
                  <span className="text-sm font-extrabold font-mono">
                    {calculateDepartureTimeStr(reminderScheduledDate, reminderScheduledTime, reminderTravelMins, reminderLeadMins)}
                  </span>
                </div>
                <Navigation className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReminderModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Salvar Lembrete</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Realtime Triggered Departure Alert Modal */}
      {triggeredReminder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in zoom-in-95 duration-200">
          <div className="bg-slate-900 border-2 border-emerald-500 text-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative text-center">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/40 flex items-center justify-center mx-auto animate-bounce">
              <Navigation className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] bg-emerald-500 text-slate-950 font-black uppercase px-2.5 py-1 rounded-full tracking-wider">
                🚨 Hora de Iniciar Deslocamento!
              </span>
              <h2 className="text-xl font-extrabold tracking-tight mt-3">
                Ordem de Serviço #{triggeredReminder.orderId}
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-1">
                Atendimento marcado para às <strong className="text-white font-mono">{triggeredReminder.scheduledTime}</strong>.
              </p>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-left text-xs space-y-2">
              <div className="flex justify-between border-b border-white/10 pb-1.5">
                <span className="text-slate-400">Técnico:</span>
                <span className="font-bold text-white">{triggeredReminder.technicianName}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-1.5">
                <span className="text-slate-400">Tempo de Viagem Estimado:</span>
                <span className="font-bold text-emerald-400">{triggeredReminder.travelTimeMinutes} minutos</span>
              </div>
              {triggeredReminder.notes && (
                <div className="pt-1">
                  <span className="text-slate-400 block text-[10px] uppercase font-extrabold">Instruções / Peças:</span>
                  <p className="text-amber-300 font-medium text-[11px] mt-0.5">{triggeredReminder.notes}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setTriggeredReminder(null)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider py-3.5 rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Ciente / Iniciar Trajeto</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

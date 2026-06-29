import React, { useState } from "react";
import { ServiceOrder, Client, BlockedDate, Professional, CurrentUser } from "../types";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, CheckCircle, ArrowRight, Plus, Lock, Trash2, ShieldAlert, Sparkles } from "lucide-react";

interface SchedulerProps {
  orders: ServiceOrder[];
  clients: Client[];
  onQuickScheduleOrder?: (date: string) => void;
  currentUser?: CurrentUser;
  professionalsList?: Professional[];
  blockedDates?: BlockedDate[];
  onAddBlockedDate?: (bDate: BlockedDate) => void;
  onDeleteBlockedDate?: (id: string) => void;
}

export default function Scheduler({ 
  orders, 
  clients, 
  onQuickScheduleOrder,
  currentUser,
  professionalsList = [],
  blockedDates = [],
  onAddBlockedDate,
  onDeleteBlockedDate
}: SchedulerProps) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 15)); // Default to June 15, 2026 (matching current time year-month)
  const [selectedDateStr, setSelectedDateStr] = useState("2026-06-15");

  const [newBlockDate, setNewBlockDate] = useState("2026-06-15");
  const [newBlockDescription, setNewBlockDescription] = useState("");
  const [newBlockType, setNewBlockType] = useState<"holiday" | "day_off">("holiday");
  const [newBlockProfId, setNewBlockProfId] = useState("all");
  const [blockError, setBlockError] = useState("");

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
    setCurrentDate(new Date(year, month - 1, 15));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 15));
  };

  // Convert day number to string date YYYY-MM-DD
  const getFormattedDateString = (day: number) => {
    const mStr = (month + 1).toString().padStart(2, "0");
    const dStr = day.toString().padStart(2, "0");
    return `${year}-${mStr}-${dStr}`;
  };

  // Find orders for a given date string
  const getOrdersForDate = (dateString: string) => {
    return orders.filter(os => os.startDate === dateString || os.endDate === dateString);
  };

  const selectedDayOrders = getOrdersForDate(selectedDateStr);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Agenda de Atendimentos</h1>
        <p className="text-sm text-slate-500 font-medium font-sans">Acompanhe os prazos de início e conclusão de serviços e as visitas marcadas na semana.</p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Calendar visual column */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          {/* Calendar Controller Header */}
          <div className="flex items-center justify-between mb-6">
            <span className="font-extrabold text-base text-slate-800 tracking-tight">
              {monthNames[month]} de {year}
            </span>
            <div className="flex bg-slate-50 border border-slate-200/55 rounded-xl p-1 gap-0.5">
              <button
                onClick={handlePrevMonth}
                className="p-1 px-2.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all font-semibold"
                title="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1 px-2.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all font-semibold"
                title="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

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
              
              // Highlight today if matching current mock time (June 15, 2026)
              const isToday = fullDateStr === "2026-06-15";

              const dayBlocks = blockedDates.filter(b => b.date === fullDateStr);
              const hasHoliday = dayBlocks.some(b => b.type === "holiday");
              const hasDayOff = dayBlocks.some(b => b.type === "day_off");

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDateStr(fullDateStr)}
                  className={`aspect-square rounded-xl p-1.5 flex flex-col justify-between items-stretch border transition-all text-left ${
                    isSelected
                      ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-950/10"
                      : isToday
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-extrabold"
                      : hasHoliday
                      ? "bg-red-50/70 border-red-200 text-red-900 hover:bg-red-100/50"
                      : hasDayOff
                      ? "bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100/50"
                      : "bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[11px] font-bold ${isSelected ? "text-white" : hasHoliday ? "text-red-700" : hasDayOff ? "text-amber-800" : "text-slate-750"}`}>
                      {day}
                    </span>
                    {dayBlocks.length > 0 && !isSelected && (
                      <span className={`text-[9px] ${hasHoliday ? "text-red-600" : "text-amber-600"}`} title={dayBlocks.map(b => b.description).join(", ")}>
                        <Lock className="w-2.5 h-2.5 shrink-0" />
                      </span>
                    )}
                  </div>

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
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details Column */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm self-stretch flex flex-col justify-between min-h-[400px]">
          <div>
            <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-4">
              <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Atendimentos no Dia</h3>
                <p className="text-xs text-slate-500 font-medium">Dia {new Date(selectedDateStr + "T12:00:00").toLocaleDateString("pt-BR")}</p>
              </div>
            </div>

            {/* Blocked Dates (Holidays/Days off) alert banner */}
            {(() => {
              const selectedDateBlocks = blockedDates.filter(b => b.date === selectedDateStr);
              if (selectedDateBlocks.length === 0) return null;
              return (
                <div className="space-y-2 mb-4">
                  {selectedDateBlocks.map((block) => (
                    <div 
                      key={block.id} 
                      className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                        block.type === "holiday" 
                          ? "bg-red-50/50 border-red-150 text-red-900" 
                          : "bg-amber-50/50 border-amber-150 text-amber-950"
                      }`}
                    >
                      <Lock className={`w-4 h-4 shrink-0 mt-0.5 ${block.type === "holiday" ? "text-red-500" : "text-amber-500"}`} />
                      <div className="text-xs">
                        <span className="font-extrabold uppercase tracking-wider block text-[9px] opacity-75">
                          {block.type === "holiday" ? "🚨 Feriado / Data Bloqueada" : "🔒 Dia de Folga Técnico"}
                        </span>
                        <p className="font-bold mt-0.5">{block.description}</p>
                        {block.type === "day_off" && block.professionalId !== "all" && (
                          <p className="text-[10px] text-amber-700 font-semibold mt-0.5">Técnico dispensado: {block.professionalId}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Services scheduled */}
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

                    <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-3.5 pt-2 border-t border-slate-200/40">
                      <Clock className="w-3.5 h-3.5 text-slate-350" />
                      <span>{os.startDate === selectedDateStr ? "ENTRADA / INÍCIO" : "PRAZO ENTREGA"}</span>
                    </div>
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
          </div>

          {/* Quick schedule dispatch callback */}
          {onQuickScheduleOrder && (
            <button
              onClick={() => onQuickScheduleOrder(selectedDateStr)}
              className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-xl shadow-lg shadow-slate-950/5 active:translate-y-[1px] transition-all flex items-center justify-center gap-2"
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
    </div>
  );
}

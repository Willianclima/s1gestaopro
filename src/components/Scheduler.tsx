import React, { useState } from "react";
import { ServiceOrder, Client } from "../types";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, CheckCircle, ArrowRight, Plus } from "lucide-react";

interface SchedulerProps {
  orders: ServiceOrder[];
  clients: Client[];
  onQuickScheduleOrder?: (date: string) => void;
}

export default function Scheduler({ orders, clients, onQuickScheduleOrder }: SchedulerProps) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 15)); // Default to June 15, 2026 (matching current time year-month)
  const [selectedDateStr, setSelectedDateStr] = useState("2026-06-15");

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

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDateStr(fullDateStr)}
                  className={`aspect-square rounded-xl p-1.5 flex flex-col justify-between items-stretch border transition-all text-left ${
                    isSelected
                      ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-950/10"
                      : isToday
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-extrabold"
                      : "bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200 text-slate-700"
                  }`}
                >
                  <span className={`text-[11px] font-bold ${isSelected ? "text-white" : "text-slate-750"}`}>
                    {day}
                  </span>

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
    </div>
  );
}

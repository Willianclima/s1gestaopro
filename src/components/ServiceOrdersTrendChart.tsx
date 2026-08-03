import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine,
  Dot
} from "recharts";
import { 
  TrendingUp, 
  Calendar, 
  AlertTriangle, 
  Activity, 
  Filter, 
  Zap, 
  ArrowUpRight, 
  Layers, 
  CheckCircle2, 
  ChevronRight, 
  BarChart3,
  ListFilter
} from "lucide-react";
import { ServiceOrder, Client } from "../types";
import { getPriorityBadge } from "./Dashboard";
import AnimatedCounter from "./AnimatedCounter";

interface ServiceOrdersTrendChartProps {
  orders: ServiceOrder[];
  clients: Client[];
  onSelectOrder?: (order: ServiceOrder) => void;
}

interface DayDataPoint {
  dateKey: string;     // e.g. "2026-07-30"
  displayDate: string; // e.g. "30/07"
  fullDateStr: string; // e.g. "30 de Julho, 2026"
  dayOfWeek: string;   // e.g. "Quinta-feira"
  count: number;
  urgentCount: number;
  completedCount: number;
  orders: ServiceOrder[];
}

export default function ServiceOrdersTrendChart({ 
  orders, 
  clients, 
  onSelectOrder 
}: ServiceOrdersTrendChartProps) {
  // State for controls
  const [timeRangeDays, setTimeRangeDays] = useState<number>(30); // 30, 14, 7
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [chartType, setChartType] = useState<"area" | "line">("area");
  const [selectedDayPoint, setSelectedDayPoint] = useState<DayDataPoint | null>(null);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.category) set.add(o.category);
    });
    return Array.from(set).sort();
  }, [orders]);

  // Determine end date anchor for the N-day window
  const endDateAnchor = useMemo(() => {
    let maxTs = 0;
    orders.forEach(o => {
      if (o.createdAt) {
        const ts = new Date(o.createdAt).getTime();
        if (!isNaN(ts) && ts > maxTs) {
          maxTs = ts;
        }
      }
    });
    return maxTs > 0 ? new Date(maxTs) : new Date();
  }, [orders]);

  // Compute dataset for the last N days
  const chartData = useMemo(() => {
    const points: DayDataPoint[] = [];
    const daysCount = timeRangeDays;

    // Filter orders by category and priority first
    const filteredOrders = orders.filter(o => {
      if (selectedCategory !== "all" && o.category !== selectedCategory) return false;
      if (selectedPriority !== "all" && o.priority !== selectedPriority) return false;
      return true;
    });

    // Generate date sequence going back N days
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(endDateAnchor);
      d.setDate(d.getDate() - i);

      const year = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, "0");
      const dayStr = String(d.getDate()).padStart(2, "0");
      const dateKey = `${year}-${monthStr}-${dayStr}`;

      const displayDate = `${dayStr}/${monthStr}`;
      
      const dayOfWeekNames = [
        "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", 
        "Quinta-feira", "Sexta-feira", "Sábado"
      ];
      const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];

      const dayOfWeek = dayOfWeekNames[d.getDay()];
      const fullDateStr = `${parseInt(dayStr, 10)} de ${monthNames[d.getMonth()]}, ${year}`;

      // Find orders created on this exact date (YYYY-MM-DD)
      const dayOrders = filteredOrders.filter(o => {
        if (!o.createdAt) return false;
        return o.createdAt.startsWith(dateKey);
      });

      const urgentCount = dayOrders.filter(o => o.priority === "urgent" || o.priority === "high").length;
      const completedCount = dayOrders.filter(o => o.status === "concluido").length;

      points.push({
        dateKey,
        displayDate,
        fullDateStr,
        dayOfWeek,
        count: dayOrders.length,
        urgentCount,
        completedCount,
        orders: dayOrders
      });
    }

    return points;
  }, [orders, endDateAnchor, timeRangeDays, selectedCategory, selectedPriority]);

  // Derived metrics for summary cards
  const totalInPeriod = useMemo(() => {
    return chartData.reduce((acc, p) => acc + p.count, 0);
  }, [chartData]);

  const avgPerDay = useMemo(() => {
    if (chartData.length === 0) return "0.0";
    return (totalInPeriod / chartData.length).toFixed(1);
  }, [totalInPeriod, chartData]);

  const peakDayInfo = useMemo(() => {
    let max = 0;
    let peakPoint: DayDataPoint | null = null;
    chartData.forEach(p => {
      if (p.count > max) {
        max = p.count;
        peakPoint = p;
      }
    });
    return { max, peakPoint };
  }, [chartData]);

  const spikeDaysCount = useMemo(() => {
    // A spike day is defined as a day with >= 3 OS or > 1.5x average
    return chartData.filter(p => p.count >= 3).length;
  }, [chartData]);

  const totalUrgentInPeriod = useMemo(() => {
    return chartData.reduce((acc, p) => acc + p.urgentCount, 0);
  }, [chartData]);

  // Client lookup helper
  const getClientName = (clientId: string) => {
    const c = clients.find(cl => cl.id === clientId);
    return c ? c.name : "Requisitante";
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6 text-left"
    >
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-650 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h3 className="font-extrabold text-base uppercase tracking-wider text-slate-800">
              Evolução Temporal de Novas Ordens de Serviço
            </h3>
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
              Últimos {timeRangeDays} Dias
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-2xl">
            Acompanhe o ritmo diário de abertura de chamados técnicos para identificar picos de demanda, sazonalidades e direcionar recursos operacionais.
          </p>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time Window Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
            {[30, 14, 7].map(days => (
              <button
                key={days}
                onClick={() => {
                  setTimeRangeDays(days);
                  setSelectedDayPoint(null);
                }}
                className={`px-3 py-1.5 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer ${
                  timeRangeDays === days
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {days}D
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedDayPoint(null);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-2 rounded-xl outline-none focus:border-indigo-500 font-bold cursor-pointer pr-7"
            >
              <option value="all">📁 Todos os Setores</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>🔧 {cat}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="relative">
            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setSelectedDayPoint(null);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-2 rounded-xl outline-none focus:border-indigo-500 font-bold cursor-pointer"
            >
              <option value="all">🎯 Todas as Prioridades</option>
              <option value="urgent">🔴 Apenas Urgentes</option>
              <option value="high">🟠 Alta Prioridade</option>
              <option value="medium">🔵 Média Prioridade</option>
              <option value="low">🟢 Baixa Prioridade</option>
            </select>
          </div>

          {/* Chart Type Toggle */}
          <button
            onClick={() => setChartType(prev => prev === "area" ? "line" : "area")}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
            title="Alternar estilo do gráfico (Área / Linha)"
          >
            {chartType === "area" ? <BarChart3 className="w-4 h-4 text-indigo-600" /> : <Layers className="w-4 h-4 text-indigo-600" />}
          </button>
        </div>
      </div>

      {/* KPI Cards for the selected period */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Total Orders */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="p-4 bg-slate-50/70 border border-slate-200/60 rounded-2xl flex flex-col justify-between"
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Total Novas OS ({timeRangeDays}d)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <AnimatedCounter value={totalInPeriod} className="text-2xl font-black text-slate-800" />
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
              {timeRangeDays} dias
            </span>
          </div>
        </motion.div>

        {/* Card 2: Average OS / Day */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl flex flex-col justify-between"
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
            Média Diária
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <AnimatedCounter value={parseFloat(avgPerDay)} decimals={1} className="text-2xl font-black text-indigo-900" />
            <span className="text-[11px] font-semibold text-indigo-600">OS / dia</span>
          </div>
        </motion.div>

        {/* Card 3: Peak Day */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="p-4 bg-amber-50/40 border border-amber-200/60 rounded-2xl flex flex-col justify-between"
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
            Pico Máximo Diário
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <div className="flex items-baseline gap-1">
              <AnimatedCounter value={peakDayInfo.max} className="text-2xl font-black text-amber-900" />
              <span className="text-xs font-bold text-amber-900">OS</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-amber-700">
              {peakDayInfo.peakPoint ? peakDayInfo.peakPoint.displayDate : "-"}
            </span>
          </div>
        </motion.div>

        {/* Card 4: Spike Days (>3 OS) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="p-4 bg-rose-50/40 border border-rose-200/60 rounded-2xl flex flex-col justify-between"
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">
            Dias de Alta Carga (≥3 OS)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <AnimatedCounter value={spikeDaysCount} className="text-2xl font-black text-rose-900" />
            <span className="text-[10px] font-bold text-rose-700">
              {totalUrgentInPeriod > 0 ? `${totalUrgentInPeriod} urgentes` : "dias com pico"}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Main Chart Graphic */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 pt-7 text-white shadow-inner relative">
        <div className="flex justify-between items-center mb-4 px-2">
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
            <span>Tendência Diária de Solicitações (Últimos {timeRangeDays} Dias)</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-indigo-500 rounded" />
              <span>Volume de OS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Chamados Urgentes</span>
            </div>
          </div>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "area" ? (
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    const point = e.activePayload[0].payload as DayDataPoint;
                    setSelectedDayPoint(point);
                  }
                }}
              >
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis 
                  dataKey="displayDate" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  dy={5}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  allowDecimals={false} 
                />
                <Tooltip content={<CustomChartTooltip />} />
                <ReferenceLine 
                  y={Number(avgPerDay)} 
                  stroke="#f59e0b" 
                  strokeDasharray="4 4" 
                  label={{ value: `Média (${avgPerDay})`, fill: '#f59e0b', fontSize: 10, position: 'right' }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  name="Novas OS" 
                  stroke="#818cf8" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                  isAnimationActive={true}
                  animationDuration={1200}
                  animationEasing="ease-out"
                  activeDot={{ r: 7, stroke: "#ffffff", strokeWidth: 2, fill: "#6366f1" }}
                />
              </AreaChart>
            ) : (
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    const point = e.activePayload[0].payload as DayDataPoint;
                    setSelectedDayPoint(point);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis 
                  dataKey="displayDate" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  dy={5}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  allowDecimals={false} 
                />
                <Tooltip content={<CustomChartTooltip />} />
                <ReferenceLine 
                  y={Number(avgPerDay)} 
                  stroke="#f59e0b" 
                  strokeDasharray="4 4" 
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  name="Novas OS" 
                  stroke="#818cf8" 
                  strokeWidth={3} 
                  isAnimationActive={true}
                  animationDuration={1200}
                  animationEasing="ease-out"
                  dot={{ r: 4, fill: "#6366f1", strokeWidth: 1, stroke: "#ffffff" }}
                  activeDot={{ r: 8, stroke: "#ffffff", strokeWidth: 2, fill: "#4f46e5" }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex justify-between items-center text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-800">
          <span>💡 Dica: Clique sobre qualquer ponto ou dia do gráfico para ver o detalhamento dos chamados.</span>
          <span>{chartData.length} dias analisados</span>
        </div>
      </div>

      {/* Selected Day Drilldown Panel */}
      <AnimatePresence>
        {selectedDayPoint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-50 border border-indigo-200 rounded-2xl p-5 space-y-4 text-left overflow-hidden shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-600 text-white rounded-xl">
                  <Calendar className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">
                    Chamados Criados em {selectedDayPoint.fullDateStr} ({selectedDayPoint.dayOfWeek})
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Total de {selectedDayPoint.count} ordens de serviço registradas neste dia.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDayPoint(null)}
                className="text-xs font-extrabold text-slate-400 hover:text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer"
              >
                Fechar [X]
              </button>
            </div>

            {selectedDayPoint.orders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedDayPoint.orders.map(os => {
                  const clientName = getClientName(os.clientId);
                  return (
                    <div
                      key={os.id}
                      onClick={() => onSelectOrder && onSelectOrder(os)}
                      className="bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl p-3.5 space-y-2 cursor-pointer transition shadow-2xs hover:shadow-md"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                          OS #{os.id}
                        </span>
                        {getPriorityBadge(os.priority)}
                      </div>

                      <h5 className="font-extrabold text-xs text-slate-800 line-clamp-1">{os.title}</h5>

                      <div className="text-[10px] text-slate-500 space-y-0.5 font-medium">
                        <p className="truncate">👤 Requisitante: <strong>{clientName}</strong></p>
                        <p className="truncate">📁 Setor: <strong>{os.category}</strong></p>
                        <p className="truncate">👨‍🔧 Técnico: <strong>{os.assignedTo || "Aguardando Triagem"}</strong></p>
                      </div>

                      <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-indigo-600 font-bold">
                        <span>Ver Detalhes</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs bg-white border border-dashed border-slate-200 rounded-2xl">
                Nenhuma ordem de serviço foi registrada nesta data específica.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Custom Tooltip component for Recharts
function CustomChartTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as DayDataPoint;
    return (
      <div className="bg-slate-900 border border-indigo-500/50 shadow-2xl rounded-2xl p-3.5 text-white text-xs space-y-2 min-w-[200px]">
        <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center">
          <span className="font-bold text-slate-200">{data.fullDateStr}</span>
          <span className="text-[9px] font-mono text-indigo-400 font-bold bg-indigo-950 px-1.5 py-0.5 rounded">
            {data.dayOfWeek}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-[11px]">Total Novas OS:</span>
            <span className="font-black text-indigo-300 text-sm">{data.count}</span>
          </div>

          {data.urgentCount > 0 && (
            <div className="flex justify-between items-center text-rose-400 text-[10px] font-bold">
              <span>Urgentes / Altas:</span>
              <span>{data.urgentCount}</span>
            </div>
          )}

          {data.completedCount > 0 && (
            <div className="flex justify-between items-center text-emerald-400 text-[10px] font-semibold">
              <span>Concluídas:</span>
              <span>{data.completedCount}</span>
            </div>
          )}
        </div>

        <p className="text-[9px] text-slate-400 italic pt-1 border-t border-slate-800 text-center">
          Clique para expandir lista
        </p>
      </div>
    );
  }
  return null;
}

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer,
  Sector
} from "recharts";
import { 
  PieChart as PieIcon, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  PauseCircle, 
  TrendingUp, 
  Activity, 
  ChevronRight, 
  Filter, 
  Award,
  Layers
} from "lucide-react";
import { ServiceOrder, Client, OSStatus } from "../types";
import { getPriorityBadge } from "./Dashboard";
import AnimatedCounter from "./AnimatedCounter";

interface ServiceOrdersStatusDoughnutChartProps {
  orders: ServiceOrder[];
  clients: Client[];
  onSelectOrder?: (order: ServiceOrder) => void;
  onOpenMetricModal?: (data: { title: string; description: string; ordersList: ServiceOrder[] }) => void;
}

export interface StatusDataPoint {
  statusKey: OSStatus;
  label: string;
  count: number;
  percentage: number;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: React.ReactNode;
  orders: ServiceOrder[];
}

const STATUS_CONFIG: Record<OSStatus, { 
  label: string; 
  color: string; 
  bgColor: string; 
  borderColor: string; 
  textColor: string; 
  iconName: string 
}> = {
  concluido: {
    label: "Concluído",
    color: "#10b981", // Emerald-500
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-700",
    iconName: "check"
  },
  em_progresso: {
    label: "Em Progresso",
    color: "#3b82f6", // Blue-500
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    iconName: "clock"
  },
  aberto: {
    label: "Pendente / Aberto",
    color: "#f59e0b", // Amber-500
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-700",
    iconName: "alert"
  },
  aguardando: {
    label: "Aguardando Insumo",
    color: "#8b5cf6", // Violet-500
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    textColor: "text-purple-700",
    iconName: "pause"
  },
  cancelado: {
    label: "Cancelado",
    color: "#f43f5e", // Rose-500
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    textColor: "text-rose-700",
    iconName: "x"
  }
};

export default function ServiceOrdersStatusDoughnutChart({
  orders,
  clients,
  onSelectOrder,
  onOpenMetricModal
}: ServiceOrdersStatusDoughnutChartProps) {
  // State for time range filter
  const [filterDays, setFilterDays] = useState<number | "all">("all");
  // Active slice index for interactive expand
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Selected status for inline list drilldown
  const [selectedStatusKey, setSelectedStatusKey] = useState<OSStatus | null>(null);

  // Filter orders by time window if set
  const filteredOrders = useMemo(() => {
    if (filterDays === "all") return orders;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filterDays);
    const cutoffTs = cutoff.getTime();

    return orders.filter(o => {
      if (!o.createdAt) return true;
      const ts = new Date(o.createdAt).getTime();
      return !isNaN(ts) && ts >= cutoffTs;
    });
  }, [orders, filterDays]);

  const totalCount = filteredOrders.length;

  // Process data for Doughnut Chart
  const statusData = useMemo<StatusDataPoint[]>(() => {
    if (totalCount === 0) return [];

    const orderMap: Record<OSStatus, ServiceOrder[]> = {
      concluido: [],
      em_progresso: [],
      aberto: [],
      aguardando: [],
      cancelado: []
    };

    filteredOrders.forEach(o => {
      if (orderMap[o.status]) {
        orderMap[o.status].push(o);
      } else {
        // Fallback for unknown status
        orderMap.aberto.push(o);
      }
    });

    const list: StatusDataPoint[] = [];

    // Desired display order: Concluído, Em Progresso, Pendente/Aberto, Aguardando, Cancelado
    const statusKeysOrder: OSStatus[] = ['concluido', 'em_progresso', 'aberto', 'aguardando', 'cancelado'];

    statusKeysOrder.forEach(key => {
      const dayOrders = orderMap[key];
      const count = dayOrders.length;
      if (count > 0 || totalCount > 0) {
        const config = STATUS_CONFIG[key];
        const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;

        let iconNode = <Clock className="w-4 h-4" />;
        if (key === "concluido") iconNode = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
        else if (key === "em_progresso") iconNode = <Clock className="w-4 h-4 text-blue-600" />;
        else if (key === "aberto") iconNode = <AlertTriangle className="w-4 h-4 text-amber-600" />;
        else if (key === "aguardando") iconNode = <PauseCircle className="w-4 h-4 text-purple-600" />;
        else if (key === "cancelado") iconNode = <XCircle className="w-4 h-4 text-rose-600" />;

        list.push({
          statusKey: key,
          label: config.label,
          count,
          percentage: parseFloat(pct.toFixed(1)),
          color: config.color,
          bgColor: config.bgColor,
          borderColor: config.borderColor,
          textColor: config.textColor,
          icon: iconNode,
          orders: dayOrders
        });
      }
    });

    return list;
  }, [filteredOrders, totalCount]);

  // Operational metrics
  const completedCount = useMemo(() => {
    return filteredOrders.filter(o => o.status === "concluido").length;
  }, [filteredOrders]);

  const completionRate = useMemo(() => {
    if (totalCount === 0) return 0;
    return Math.round((completedCount / totalCount) * 100);
  }, [completedCount, totalCount]);

  const activeBacklogCount = useMemo(() => {
    return filteredOrders.filter(o => o.status === "em_progresso" || o.status === "aberto").length;
  }, [filteredOrders]);

  const activeBacklogRate = useMemo(() => {
    if (totalCount === 0) return 0;
    return Math.round((activeBacklogCount / totalCount) * 100);
  }, [activeBacklogCount, totalCount]);

  const waitingMaterialCount = useMemo(() => {
    return filteredOrders.filter(o => o.status === "aguardando" || o.hasMissingMaterial).length;
  }, [filteredOrders]);

  // Active status details for drilldown
  const activeStatusDetails = useMemo(() => {
    if (!selectedStatusKey) return null;
    return statusData.find(s => s.statusKey === selectedStatusKey) || null;
  }, [selectedStatusKey, statusData]);

  // Client name lookup
  const getClientName = (clientId: string) => {
    const c = clients.find(cl => cl.id === clientId);
    return c ? c.name : "Requisitante";
  };

  // Render active sector shape on hover
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 2}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          stroke="#ffffff"
          strokeWidth={3}
        />
      </g>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6 text-left"
    >
      {/* Header section */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 text-emerald-650 rounded-xl">
              <PieIcon className="w-5 h-5" />
            </span>
            <h3 className="font-extrabold text-base uppercase tracking-wider text-slate-800">
              Distribuição por Status & Eficiência Operacional
            </h3>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
              {filterDays === "all" ? "Período Total" : `Últimos ${filterDays} Dias`}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-2xl">
            Visão gráfica rosca da proporção dos chamados (Concluído vs Em Execução vs Pendentes). Avalie a taxa global de resolutividade do departamento.
          </p>
        </div>

        {/* Time range filter buttons */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider hidden sm:inline">
            Filtro Temporal:
          </span>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
            {[
              { label: "Tudo", val: "all" },
              { label: "30D", val: 30 },
              { label: "14D", val: 14 },
              { label: "7D", val: 7 }
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={() => {
                  setFilterDays(btn.val as any);
                  setSelectedStatusKey(null);
                }}
                className={`px-3 py-1.5 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer ${
                  filterDays === btn.val
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 3 KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Completion Rate */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded-2xl flex items-center justify-between"
        >
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
              Taxa de Resolução
            </span>
            <div className="flex items-baseline gap-1.5">
              <AnimatedCounter value={completionRate} suffix="%" className="text-2xl font-black text-emerald-950" />
              <span className="text-xs font-bold text-emerald-700">({completedCount} OS)</span>
            </div>
            <p className="text-[10px] text-emerald-700/80 font-medium">Chamados concluídos com sucesso</p>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </motion.div>

        {/* KPI 2: Active Backlog */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="p-4 bg-blue-50/50 border border-blue-200/60 rounded-2xl flex items-center justify-between"
        >
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
              Em Atendimento (Em Progresso + Aberto)
            </span>
            <div className="flex items-baseline gap-1.5">
              <AnimatedCounter value={activeBacklogRate} suffix="%" className="text-2xl font-black text-blue-950" />
              <span className="text-xs font-bold text-blue-700">({activeBacklogCount} OS)</span>
            </div>
            <p className="text-[10px] text-blue-700/80 font-medium">Capacidade ativa das equipes</p>
          </div>
          <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shrink-0">
            <Activity className="w-6 h-6" />
          </div>
        </motion.div>

        {/* KPI 3: Waiting Material / Bottlenecks */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="p-4 bg-purple-50/50 border border-purple-200/60 rounded-2xl flex items-center justify-between"
        >
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700">
              Aguardando Material / Insumos
            </span>
            <div className="flex items-baseline gap-1.5">
              <AnimatedCounter value={waitingMaterialCount} className="text-2xl font-black text-purple-950" />
              <span className="text-xs font-bold text-purple-700">
                ({totalCount > 0 ? Math.round((waitingMaterialCount / totalCount) * 100) : 0}%)
              </span>
            </div>
            <p className="text-[10px] text-purple-700/80 font-medium">Gargalos dependentes do almoxarifado</p>
          </div>
          <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl shrink-0">
            <PauseCircle className="w-6 h-6" />
          </div>
        </motion.div>
      </div>

      {/* Main Grid: Doughnut Graphic + Legend Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Doughnut Canvas with central KPI */}
        <div className="lg:col-span-5 relative flex flex-col items-center justify-center p-4 bg-slate-50/60 border border-slate-100 rounded-3xl min-h-[300px]">
          <div className="h-[260px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="label"
                  isAnimationActive={true}
                  animationDuration={1200}
                  animationEasing="ease-out"
                  animationBegin={100}
                  activeIndex={activeIndex !== null ? activeIndex : undefined}
                  activeShape={renderActiveShape}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={(_, index) => {
                    const item = statusData[index];
                    if (item) {
                      setSelectedStatusKey(prev => prev === item.statusKey ? null : item.statusKey);
                    }
                  }}
                  cursor="pointer"
                >
                  {statusData.map((entry) => (
                    <Cell 
                      key={`cell-${entry.statusKey}`} 
                      fill={entry.color} 
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomDoughnutTooltip total={totalCount} />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Central Badge in the Doughnut Hole */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                Total Geral
              </span>
              <AnimatedCounter value={totalCount} className="text-3xl font-black text-slate-800 tracking-tight leading-none my-0.5" />
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                {completionRate}% Concluídos
              </span>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 font-medium text-center mt-1">
            Passe o mouse ou toque na fatia para destacar a proporção do status.
          </p>
        </div>

        {/* Right Column: Interactive Status Cards */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Detalhamento Por Status
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Clique em um card para filtrar
            </span>
          </div>

          <div className="space-y-2.5">
            {statusData.map((item, idx) => {
              const isSelected = selectedStatusKey === item.statusKey;
              return (
                <motion.div
                  key={item.statusKey}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.08 }}
                  onClick={() => setSelectedStatusKey(prev => prev === item.statusKey ? null : item.statusKey)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected 
                      ? `${item.bgColor} ${item.borderColor} ring-2 ring-indigo-400/40 shadow-xs` 
                      : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Status Name + Dot */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span 
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs" 
                        style={{ backgroundColor: item.color }} 
                      />
                      <div className="truncate">
                        <h4 className="font-extrabold text-xs text-slate-800 truncate">
                          {item.label}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {item.count} {item.count === 1 ? 'chamado' : 'chamados'} registrados
                        </p>
                      </div>
                    </div>

                    {/* Percentage Pill + Progress bar */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="w-24 hidden sm:block">
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${item.percentage}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.1 }}
                            className="h-full rounded-full" 
                            style={{ 
                              backgroundColor: item.color 
                            }} 
                          />
                        </div>
                      </div>

                      <div className="text-right">
                        <AnimatedCounter value={item.percentage} decimals={1} suffix="%" className={`text-sm font-black ${item.textColor}`} />
                      </div>

                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? "rotate-90 text-indigo-600" : "text-slate-300"}`} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Status Drilldown Modal / Panel */}
      <AnimatePresence>
        {activeStatusDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`rounded-2xl p-5 border space-y-4 ${activeStatusDetails.bgColor} ${activeStatusDetails.borderColor}`}
          >
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-xl bg-white shadow-2xs`}>
                  {activeStatusDetails.icon}
                </span>
                <div>
                  <h4 className={`font-extrabold text-sm ${activeStatusDetails.textColor}`}>
                    Ordens de Serviço com Status: "{activeStatusDetails.label}" ({activeStatusDetails.count})
                  </h4>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Representa {activeStatusDetails.percentage}% do volume total de chamados.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onOpenMetricModal && (
                  <button
                    onClick={() => onOpenMetricModal({
                      title: `Filtro: ${activeStatusDetails.label}`,
                      description: `Lista completa de todas as ordens de serviço com status "${activeStatusDetails.label}".`,
                      ordersList: activeStatusDetails.orders
                    })}
                    className="text-xs font-extrabold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-3 py-1.5 rounded-xl cursor-pointer shadow-2xs"
                  >
                    Abrir em Tela Cheia ↗
                  </button>
                )}

                <button
                  onClick={() => setSelectedStatusKey(null)}
                  className="text-xs font-extrabold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  Fechar [X]
                </button>
              </div>
            </div>

            {/* List of Orders in this status */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeStatusDetails.orders.slice(0, 9).map(os => {
                const clientName = getClientName(os.clientId);
                return (
                  <div
                    key={os.id}
                    onClick={() => onSelectOrder && onSelectOrder(os)}
                    className="bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl p-3.5 space-y-2 cursor-pointer transition shadow-2xs hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        OS #{os.id}
                      </span>
                      {getPriorityBadge(os.priority)}
                    </div>

                    <h5 className="font-extrabold text-xs text-slate-800 line-clamp-1">{os.title}</h5>

                    <div className="text-[10px] text-slate-500 space-y-0.5 font-medium">
                      <p className="truncate">👤 Requisitante: <strong>{clientName}</strong></p>
                      <p className="truncate">📁 Setor: <strong>{os.category}</strong></p>
                      <p className="truncate">👨‍🔧 Técnico: <strong>{os.assignedTo || "Sem técnico designado"}</strong></p>
                    </div>

                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-indigo-600 font-bold">
                      <span>Ver Detalhes da OS</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                );
              })}
            </div>

            {activeStatusDetails.orders.length > 9 && (
              <p className="text-[11px] text-center text-slate-500 font-medium italic pt-1">
                Exibindo as 9 mais recentes de um total de {activeStatusDetails.orders.length} OS neste status.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Custom Tooltip component for Doughnut chart
function CustomDoughnutTooltip({ active, payload, total }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as StatusDataPoint;
    return (
      <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-3 text-white text-xs space-y-1.5 min-w-[180px]">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
          <span className="font-extrabold text-slate-200">{data.label}</span>
        </div>

        <div className="flex justify-between items-center text-slate-300">
          <span className="text-[11px]">Quantidade:</span>
          <span className="font-black text-white text-sm">{data.count} OS</span>
        </div>

        <div className="flex justify-between items-center text-slate-300">
          <span className="text-[11px]">Proporção:</span>
          <span className="font-black text-emerald-400 text-sm">{data.percentage}%</span>
        </div>

        <p className="text-[9px] text-slate-400 italic pt-1 border-t border-slate-800 text-center">
          Clique no card para ver a lista
        </p>
      </div>
    );
  }
  return null;
}

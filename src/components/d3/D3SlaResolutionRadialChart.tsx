import React, { useRef, useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import { ServiceOrder } from "../../types";
import { ShieldCheck, Clock, CheckCircle2, AlertTriangle, Zap, ArrowUpRight, Activity } from "lucide-react";

interface D3SlaResolutionRadialChartProps {
  orders: ServiceOrder[];
  onOpenMetricModal?: (data: { title: string; description: string; ordersList: ServiceOrder[] }) => void;
}

interface RingMetric {
  id: string;
  name: string;
  percentage: number;
  numerator: number;
  denominator: number;
  color: string;
  gradientStart: string;
  gradientEnd: string;
  bgTrack: string;
  description: string;
  orders: ServiceOrder[];
  unit: string;
}

export default function D3SlaResolutionRadialChart({
  orders,
  onOpenMetricModal
}: D3SlaResolutionRadialChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeRingId, setActiveRingId] = useState<string | null>(null);
  const prevAnglesRef = useRef<Record<string, number>>({});

  // Compute SLA, completion and urgent resolution rates
  const metrics: RingMetric[] = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter(o => o.status === "concluido");
    
    // 1. SLA On-Time (Resolvidos dentro de 5 dias ou antes da data prevista de conclusão)
    const onTimeOrders = completed.filter(o => {
      const start = new Date(o.createdAt).getTime();
      const end = new Date(o.endDate || o.createdAt).getTime();
      if (!isNaN(start) && !isNaN(end)) {
        const days = (end - start) / (1000 * 60 * 60 * 24);
        return days <= 5;
      }
      return true;
    });
    const slaPercentage = completed.length > 0 ? Math.round((onTimeOrders.length / completed.length) * 100) : 100;

    // 2. Global Resolution Rate
    const globalRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

    // 3. Urgent/High Priority Resolution Rate
    const urgentOrders = orders.filter(o => o.priority === "urgent" || o.priority === "high");
    const urgentCompleted = urgentOrders.filter(o => o.status === "concluido");
    const urgentRate = urgentOrders.length > 0 ? Math.round((urgentCompleted.length / urgentOrders.length) * 100) : 100;

    return [
      {
        id: "sla",
        name: "Conformidade SLA (< 5 dias)",
        percentage: slaPercentage,
        numerator: onTimeOrders.length,
        denominator: completed.length,
        color: "#6366F1",
        gradientStart: "#818CF8",
        gradientEnd: "#4F46E5",
        bgTrack: "#EEF2FF",
        description: "Chamados finalizados dentro do prazo estipulado de até 5 dias úteis.",
        orders: onTimeOrders,
        unit: "das concluídas"
      },
      {
        id: "resolution",
        name: "Taxa de Resolução Global",
        percentage: globalRate,
        numerator: completed.length,
        denominator: total,
        color: "#10B981",
        gradientStart: "#34D399",
        gradientEnd: "#059669",
        bgTrack: "#ECFDF5",
        description: "Percentual de todas as ordens de serviço emitidas que já foram concluídas.",
        orders: completed,
        unit: "do total"
      },
      {
        id: "urgent",
        name: "Resolução de OS Críticas/Urgentes",
        percentage: urgentRate,
        numerator: urgentCompleted.length,
        denominator: urgentOrders.length,
        color: "#F43F5E",
        gradientStart: "#FB7185",
        gradientEnd: "#E11D48",
        bgTrack: "#FFF1F2",
        description: "Atendimentos de alta prioridade ou emergência já solucionados pelas equipes.",
        orders: urgentCompleted,
        unit: "das urgentes"
      }
    ];
  }, [orders]);

  const activeMetric = useMemo(() => {
    if (!activeRingId) return metrics[0];
    return metrics.find(m => m.id === activeRingId) || metrics[0];
  }, [metrics, activeRingId]);

  // Render D3 Multi-Ring Radial Gauge with Transitions
  useEffect(() => {
    if (!svgRef.current || metrics.length === 0) return;

    const width = 320;
    const height = 320;
    const center = width / 2;
    const svg = d3.select(svgRef.current);

    svg.attr("viewBox", `0 0 ${width} ${height}`)
       .attr("width", "100%")
       .attr("height", height);

    let defs = svg.select<SVGDefsElement>("defs");
    if (defs.empty()) {
      defs = svg.append("defs");
    }

    // Add/update gradients for each ring
    metrics.forEach((m) => {
      let grad = defs.select<SVGLinearGradientElement>(`#radial-grad-${m.id}`);
      if (grad.empty()) {
        grad = defs.append("linearGradient")
          .attr("id", `radial-grad-${m.id}`)
          .attr("x1", "0%")
          .attr("y1", "0%")
          .attr("x2", "100%")
          .attr("y2", "100%");
        
        grad.append("stop").attr("class", "stop-start").attr("offset", "0%");
        grad.append("stop").attr("class", "stop-end").attr("offset", "100%");
      }
      grad.select(".stop-start").attr("stop-color", m.gradientStart);
      grad.select(".stop-end").attr("stop-color", m.gradientEnd);
    });

    let g = svg.select<SVGGElement>("g.radial-container");
    if (g.empty()) {
      g = svg.append("g")
        .attr("class", "radial-container")
        .attr("transform", `translate(${center}, ${center})`);
      
      // Center Click Target Circle
      g.append("circle")
        .attr("class", "center-circle")
        .attr("r", 65)
        .attr("fill", "#FFFFFF")
        .attr("filter", "drop-shadow(0 2px 8px rgba(0,0,0,0.06))")
        .style("cursor", "pointer");
    } else {
      g.attr("transform", `translate(${center}, ${center})`);
    }

    g.select(".center-circle")
      .on("click", () => {
        if (onOpenMetricModal && activeMetric) {
          onOpenMetricModal({
            title: activeMetric.name,
            description: activeMetric.description,
            ordersList: activeMetric.orders
          });
        }
      });

    const ringThickness = 16;
    const ringSpacing = 7;
    const maxRadius = 140;

    metrics.forEach((metric, index) => {
      const outerR = maxRadius - index * (ringThickness + ringSpacing);
      const innerR = outerR - ringThickness;

      const arcBg = d3.arc()
        .innerRadius(innerR)
        .outerRadius(outerR)
        .startAngle(0)
        .endAngle(2 * Math.PI)
        .cornerRadius(8);

      let bgPath = g.select<SVGPathElement>(`path.bg-ring-${metric.id}`);
      if (bgPath.empty()) {
        bgPath = g.append("path")
          .attr("class", `bg-ring-${metric.id}`)
          .attr("opacity", 0.9);
      }
      bgPath
        .attr("d", arcBg as any)
        .attr("fill", metric.bgTrack);

      // Target Angle for Value Arc
      const targetAngle = (metric.percentage / 100) * 2 * Math.PI;
      const prevAngle = prevAnglesRef.current[metric.id] !== undefined ? prevAnglesRef.current[metric.id] : 0;

      const arcForeground = d3.arc()
        .innerRadius(innerR)
        .outerRadius(outerR)
        .startAngle(0)
        .cornerRadius(8);

      let valPath = g.select<SVGPathElement>(`path.val-ring-${metric.id}`);
      if (valPath.empty()) {
        valPath = g.append("path")
          .attr("class", `val-ring-${metric.id}`)
          .datum({ endAngle: prevAngle })
          .attr("fill", `url(#radial-grad-${metric.id})`)
          .style("cursor", "pointer");
      }

      valPath
        .on("mouseenter", () => setActiveRingId(metric.id))
        .on("click", () => {
          if (onOpenMetricModal) {
            onOpenMetricModal({
              title: metric.name,
              description: metric.description,
              ordersList: metric.orders
            });
          }
        });

      // Smooth d3-transition interpolation from previous angle to target angle
      valPath
        .transition()
        .duration(900)
        .delay(index * 120)
        .ease(d3.easeCubicOut)
        .attrTween("d", function(d: any) {
          const start = d.endAngle !== undefined ? d.endAngle : prevAngle;
          const interpolate = d3.interpolate(start, targetAngle);
          return function(t: number) {
            d.endAngle = interpolate(t);
            return arcForeground(d as any) || "";
          };
        })
        .on("end", () => {
          prevAnglesRef.current[metric.id] = targetAngle;
        });
    });

  }, [metrics]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
              Conformidade de SLA & Eficiência Operacional (D3 Multi-Ring Gauge)
            </h3>
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-150">
              D3.js
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Indicadores radiais concêntricos de pontualidade no atendimento, resolução global e emergências.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: D3 Radial SVG with Center Readout */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
          <div className="relative w-[320px] h-[320px] flex items-center justify-center">
            <svg ref={svgRef} className="w-full h-full" />

            {/* Live Center Readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-6">
              <span className="text-3xl font-black text-slate-800 font-mono tracking-tight">
                {activeMetric?.percentage}%
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 max-w-[100px] truncate">
                {activeMetric?.name.split(" ")[0]}
              </span>
              <span className="text-[8.5px] text-indigo-600 font-bold mt-0.5">
                {activeMetric?.numerator} de {activeMetric?.denominator}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Interactive KPI Metric Cards */}
        <div className="lg:col-span-7 space-y-3">
          {metrics.map((metric, idx) => {
            const isActive = activeRingId === metric.id || (!activeRingId && idx === 0);

            return (
              <div
                key={metric.id}
                onMouseEnter={() => setActiveRingId(metric.id)}
                onClick={() => {
                  if (onOpenMetricModal) {
                    onOpenMetricModal({
                      title: metric.name,
                      description: metric.description,
                      ordersList: metric.orders
                    });
                  }
                }}
                className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left flex items-center justify-between gap-4 ${
                  isActive
                    ? "bg-slate-50/90 border-indigo-400 shadow-xs ring-1 ring-indigo-400"
                    : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: metric.color }}
                    />
                    <h4 className="text-xs font-black text-slate-800">{metric.name}</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed pl-5">
                    {metric.description}
                  </p>
                  <div className="pl-5 text-[10px] font-bold text-slate-400 font-mono">
                    {metric.numerator} / {metric.denominator} chamados ({metric.unit})
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className="text-2xl font-black font-mono block"
                    style={{ color: metric.color }}
                  >
                    {metric.percentage}%
                  </span>
                  <span className="text-[9px] font-bold text-indigo-600 flex items-center gap-0.5 justify-end">
                    Detalhar <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

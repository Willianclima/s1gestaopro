import React, { useRef, useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import { ServiceOrder, Professional } from "../../types";
import { Wrench, Trophy, ArrowUpDown, CheckCircle, Clock, AlertTriangle, Users, Filter } from "lucide-react";

interface D3TechnicianPerformanceChartProps {
  orders: ServiceOrder[];
  professionals: Professional[];
  onSelectTechnician?: (techName: string, orders: ServiceOrder[]) => void;
  onSelectOrder?: (order: ServiceOrder) => void;
}

interface TechBarData {
  name: string;
  professional?: Professional;
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  waiting: number;
  resolutionRate: number;
  avgDurationDays: number;
  orders: ServiceOrder[];
}

export default function D3TechnicianPerformanceChart({
  orders,
  professionals,
  onSelectTechnician,
  onSelectOrder
}: D3TechnicianPerformanceChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [sortBy, setSortBy] = useState<"total" | "completed" | "resolutionRate" | "name">("total");
  const [hoveredTech, setHoveredTech] = useState<TechBarData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Compute technician performance metrics
  const techData: TechBarData[] = useMemo(() => {
    const map = new Map<string, ServiceOrder[]>();
    
    // Group orders by assigned technician
    orders.forEach(o => {
      if (o.assignedTo && o.assignedTo.trim()) {
        const name = o.assignedTo.trim();
        if (!map.has(name)) map.set(name, []);
        map.get(name)!.push(o);
      }
    });

    // Also include registered professionals who may have 0 orders
    professionals.forEach(p => {
      if (!map.has(p.name)) {
        map.set(p.name, []);
      }
    });

    const list: TechBarData[] = [];
    map.forEach((techOrders, name) => {
      const completedOrders = techOrders.filter(o => o.status === "concluido");
      const inProgressOrders = techOrders.filter(o => o.status === "em_progresso");
      const pendingOrders = techOrders.filter(o => o.status === "aberto");
      const waitingOrders = techOrders.filter(o => o.status === "aguardando");

      const total = techOrders.length;
      const completed = completedOrders.length;
      const resolutionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Calculate avg duration for completed orders
      const durations = completedOrders.map(o => {
        const start = new Date(o.createdAt).getTime();
        const end = new Date(o.endDate || o.createdAt).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          return (end - start) / (1000 * 60 * 60 * 24);
        }
        return null;
      }).filter((d): d is number => d !== null);

      const avgDurationDays = durations.length > 0
        ? Number((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1))
        : 0;

      const prof = professionals.find(p => p.name.toLowerCase() === name.toLowerCase());

      list.push({
        name,
        professional: prof,
        total,
        completed,
        inProgress: inProgressOrders.length,
        pending: pendingOrders.length,
        waiting: waitingOrders.length,
        resolutionRate,
        avgDurationDays,
        orders: techOrders
      });
    });

    // Sort list based on selected criteria
    return list.sort((a, b) => {
      if (sortBy === "total") return b.total - a.total;
      if (sortBy === "completed") return b.completed - a.completed;
      if (sortBy === "resolutionRate") return b.resolutionRate - a.resolutionRate;
      return a.name.localeCompare(b.name);
    });
  }, [orders, professionals, sortBy]);

  // Top performer highlight
  const topTech = useMemo(() => {
    if (techData.length === 0) return null;
    const withCompleted = [...techData].filter(t => t.total > 0).sort((a, b) => b.completed - a.completed);
    return withCompleted[0] || null;
  }, [techData]);

  // Render D3 Stacked Horizontal Bar Chart with Transitions
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || techData.length === 0) return;

    const containerWidth = containerRef.current.clientWidth || 700;
    const margin = { top: 20, right: 90, bottom: 40, left: 140 };
    const barHeight = 36;
    const height = Math.max(280, techData.length * (barHeight + 12) + margin.top + margin.bottom);
    const width = containerWidth;

    const svg = d3.select(svgRef.current);

    svg.attr("viewBox", `0 0 ${width} ${height}`)
       .attr("width", "100%")
       .attr("height", height);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Get or create main chart container
    let g = svg.select<SVGGElement>("g.main-chart-group");
    if (g.empty()) {
      g = svg.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
      
      g.append("g").attr("class", "grid");
      g.append("g").attr("class", "x-axis");
      g.append("g").attr("class", "y-axis");
      g.append("g").attr("class", "bars-container");
    } else {
      g.attr("transform", `translate(${margin.left}, ${margin.top})`);
    }

    // X Scale: Max total orders with padding
    const maxTotal = d3.max(techData, d => d.total) || 5;
    const xScale = d3.scaleLinear()
      .domain([0, Math.max(maxTotal, 5)])
      .nice()
      .range([0, innerWidth]);

    // Y Scale: Band scale for technician names
    const yScale = d3.scaleBand()
      .domain(techData.map(d => d.name))
      .range([0, innerHeight])
      .padding(0.28);

    const t = d3.transition().duration(750).ease(d3.easeCubicInOut);

    // Subtle grid lines with transition
    g.select<SVGGElement>("g.grid")
      .attr("transform", `translate(0, ${innerHeight})`)
      .transition(t)
      .call(
        d3.axisBottom(xScale)
          .ticks(5)
          .tickSize(-innerHeight)
          .tickFormat(() => "")
      )
      .selectAll("line")
      .attr("stroke", "#F1F5F9")
      .attr("stroke-dasharray", "3,3");

    // X Axis bottom with transition
    const xAxis = g.select<SVGGElement>("g.x-axis")
      .attr("transform", `translate(0, ${innerHeight})`);

    xAxis.transition(t)
      .call(
        d3.axisBottom(xScale)
          .ticks(6)
          .tickFormat(d => `${d} OS`)
      );

    xAxis.select(".domain").attr("stroke", "#E2E8F0");
    xAxis.selectAll("text")
      .attr("font-size", "10px")
      .attr("font-weight", "700")
      .attr("fill", "#64748B")
      .attr("dy", "8px");

    // Y Axis left (technician labels) with animated repositioning
    const yAxis = g.select<SVGGElement>("g.y-axis");

    yAxis.transition(t)
      .call(d3.axisLeft(yScale));

    yAxis.select(".domain").remove();
    yAxis.selectAll("line").remove();
    yAxis.selectAll<SVGTextElement, string>("text")
      .attr("font-size", "11px")
      .attr("font-weight", "800")
      .attr("fill", "#1E293B")
      .attr("dx", "-8px")
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        const item = techData.find(tItem => tItem.name === d);
        if (item && onSelectTechnician) {
          onSelectTechnician(item.name, item.orders);
        }
      });

    // Bars Container with Data-Join (keyed by technician name)
    const barsContainer = g.select<SVGGElement>("g.bars-container");
    const barGroups = barsContainer.selectAll<SVGGElement, TechBarData>(".tech-bar-group")
      .data(techData, d => d.name);

    // EXIT: Animate out removed technicians
    barGroups.exit()
      .transition(t)
      .duration(400)
      .style("opacity", 0)
      .attr("transform", (d: any) => `translate(0, ${innerHeight + 30})`)
      .remove();

    // ENTER: Append new group
    const barEnter = barGroups.enter()
      .append("g")
      .attr("class", "tech-bar-group")
      .attr("transform", d => `translate(0, ${yScale(d.name) || 0})`)
      .style("cursor", "pointer")
      .style("opacity", 0);

    // Background track
    barEnter.append("rect")
      .attr("class", "bg-track")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerWidth)
      .attr("height", yScale.bandwidth())
      .attr("fill", "#F8FAFC")
      .attr("rx", 6);

    // Segment 1: Completed Orders (Emerald)
    barEnter.append("rect")
      .attr("class", "bar-completed")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", yScale.bandwidth())
      .attr("fill", "#10B981")
      .attr("rx", 6);

    // Segment 2: In Progress (Blue)
    barEnter.append("rect")
      .attr("class", "bar-inprogress")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", yScale.bandwidth())
      .attr("fill", "#3B82F6");

    // Segment 3: Waiting / Missing Material (Amber)
    barEnter.append("rect")
      .attr("class", "bar-waiting")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", yScale.bandwidth())
      .attr("fill", "#F59E0B");

    // Segment 4: Pending / Open (Slate)
    barEnter.append("rect")
      .attr("class", "bar-pending")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", yScale.bandwidth())
      .attr("fill", "#94A3B8");

    // End-of-bar Resolution Rate Badge
    barEnter.append("text")
      .attr("class", "label-rate")
      .attr("x", 0)
      .attr("y", yScale.bandwidth() / 2 + 4)
      .attr("font-size", "11px")
      .attr("font-weight", "900")
      .attr("font-family", "monospace");

    // End-of-bar Total count label
    barEnter.append("text")
      .attr("class", "label-total")
      .attr("x", 0)
      .attr("y", yScale.bandwidth() / 2 + 4)
      .attr("font-size", "10px")
      .attr("font-weight", "700")
      .attr("fill", "#94A3B8");

    // MERGE: Update positions, dimensions, and contents with animated transitions
    const barMerge = barEnter.merge(barGroups);

    barMerge.transition(t)
      .attr("transform", d => `translate(0, ${yScale(d.name) || 0})`)
      .style("opacity", 1);

    barMerge.select(".bg-track")
      .transition(t)
      .attr("width", innerWidth)
      .attr("height", yScale.bandwidth());

    barMerge.select(".bar-completed")
      .transition(t)
      .attr("x", 0)
      .attr("width", d => xScale(d.completed))
      .attr("height", yScale.bandwidth());

    barMerge.select(".bar-inprogress")
      .transition(t)
      .attr("x", d => xScale(d.completed))
      .attr("width", d => xScale(d.inProgress))
      .attr("height", yScale.bandwidth());

    barMerge.select(".bar-waiting")
      .transition(t)
      .attr("x", d => xScale(d.completed + d.inProgress))
      .attr("width", d => xScale(d.waiting))
      .attr("height", yScale.bandwidth());

    barMerge.select(".bar-pending")
      .transition(t)
      .attr("x", d => xScale(d.completed + d.inProgress + d.waiting))
      .attr("width", d => xScale(d.pending))
      .attr("height", yScale.bandwidth());

    barMerge.select(".label-rate")
      .transition(t)
      .attr("x", d => xScale(d.total) + 10)
      .attr("y", yScale.bandwidth() / 2 + 4)
      .attr("fill", d => d.resolutionRate >= 70 ? "#059669" : d.resolutionRate >= 40 ? "#2563EB" : "#D97706")
      .text(d => d.total > 0 ? `${d.resolutionRate}%` : "0%");

    barMerge.select(".label-total")
      .transition(t)
      .attr("x", d => xScale(d.total) + 48)
      .attr("y", yScale.bandwidth() / 2 + 4)
      .text(d => `(${d.total})`);

    // Hover & Click Interactions on merged selection
    barMerge
      .on("mouseenter", function(event, d) {
        setHoveredTech(d);
        const [x, y] = d3.pointer(event, containerRef.current);
        setTooltipPos({ x, y });

        d3.select(this).selectAll("rect:not(.bg-track)")
          .transition()
          .duration(150)
          .attr("opacity", 0.85);
      })
      .on("mousemove", function(event) {
        const [x, y] = d3.pointer(event, containerRef.current);
        setTooltipPos({ x, y });
      })
      .on("mouseleave", function() {
        setHoveredTech(null);
        setTooltipPos(null);

        d3.select(this).selectAll("rect:not(.bg-track)")
          .transition()
          .duration(200)
          .attr("opacity", 1);
      })
      .on("click", function(event, d) {
        if (onSelectTechnician) {
          onSelectTechnician(d.name, d.orders);
        }
      });

  }, [techData, sortBy]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5 relative">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
              Desempenho & Carga de Trabalho por Técnico (D3 Dynamic Stacked Bars)
            </h3>
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-150">
              D3.js
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Comparativo de chamados concluídos, em andamento e pendências por profissional de campo.
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3" /> Ordenar:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-bold outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="total">📊 Maior Volume Total</option>
            <option value="completed">✅ Mais Concluídas</option>
            <option value="resolutionRate">🎯 Maior Taxa de Resolução (%)</option>
            <option value="name">🔤 Nome Alfabético</option>
          </select>
        </div>
      </div>

      {/* Top performer highlight bar */}
      {topTech && topTech.total > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 via-emerald-50/50 to-white border border-indigo-100 rounded-2xl p-3.5 flex items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-600 flex items-center justify-center font-bold">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 block">Destaque de Eficiência</span>
              <p className="text-xs font-extrabold text-slate-800">
                {topTech.name} • <span className="text-emerald-600 font-bold">{topTech.completed} ordens concluídas</span> ({topTech.resolutionRate}% de resolução)
              </p>
            </div>
          </div>

          <button
            onClick={() => onSelectTechnician && onSelectTechnician(topTech.name, topTech.orders)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer shadow-xs"
          >
            Ver Chamados
          </button>
        </div>
      )}

      {/* D3 Canvas Container */}
      <div ref={containerRef} className="relative w-full overflow-x-auto min-h-[280px]">
        <svg ref={svgRef} className="w-full h-auto overflow-visible" />

        {/* Floating D3 Tooltip */}
        {hoveredTech && tooltipPos && (
          <div
            className="absolute z-30 pointer-events-none bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-xl border border-slate-800 text-left min-w-[240px] transition-all duration-75 transform -translate-x-1/2 -translate-y-full mb-3"
            style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <div>
                <span className="font-extrabold text-xs text-indigo-300 block">{hoveredTech.name}</span>
                <span className="text-[9px] text-slate-400">{hoveredTech.professional?.specialty || "Técnico Especialista"}</span>
              </div>
              <span className="bg-emerald-600 text-white font-mono text-[10px] font-black px-2 py-0.5 rounded-full">
                {hoveredTech.resolutionRate}% resolvido
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center text-emerald-400">
                <span>✅ Concluídas com Êxito:</span>
                <span className="font-mono font-bold">{hoveredTech.completed} OS</span>
              </div>
              <div className="flex justify-between items-center text-blue-400">
                <span>⚡ Em Execução de Campo:</span>
                <span className="font-mono font-bold">{hoveredTech.inProgress} OS</span>
              </div>
              <div className="flex justify-between items-center text-amber-400">
                <span>⚠️ Aguardando Peça/Material:</span>
                <span className="font-mono font-bold">{hoveredTech.waiting} OS</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>⏳ Triagem / Pendente:</span>
                <span className="font-mono font-bold">{hoveredTech.pending} OS</span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-300">
              <span>Tempo médio p/ fechar:</span>
              <span className="font-mono font-bold text-white">{hoveredTech.avgDurationDays} dias</span>
            </div>

            <p className="mt-2 text-[8.5px] text-slate-400 text-center uppercase tracking-wider font-semibold">
              Clique para inspecionar ordens do técnico
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-600 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500" />
          <span>Concluído</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-500" />
          <span>Em Execução</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500" />
          <span>Aguardando Material</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-400" />
          <span>Pendente / Aberto</span>
        </div>
      </div>
    </div>
  );
}

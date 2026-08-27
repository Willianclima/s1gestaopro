import React, { useRef, useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import { ServiceOrder } from "../../types";
import { Calendar, TrendingUp, Filter, Sparkles, X, ChevronRight, Zap } from "lucide-react";
import { getPriorityBadge } from "../Dashboard";

interface D3WeeklyActivityHeatmapProps {
  orders: ServiceOrder[];
  onSelectOrder?: (order: ServiceOrder) => void;
  onOpenMetricModal?: (data: { title: string; description: string; ordersList: ServiceOrder[] }) => void;
}

const TIME_PERIODS = [
  { id: 0, label: "Madrugada (00h - 08h)", rangeName: "Madrugada", hours: "00h - 08h" },
  { id: 1, label: "Manhã (08h - 12h)", rangeName: "Manhã", hours: "08h - 12h" },
  { id: 2, label: "Tarde (12h - 18h)", rangeName: "Tarde", hours: "12h - 18h" },
  { id: 3, label: "Noite (18h - 00h)", rangeName: "Noite", hours: "18h - 00h" },
];

const DAYS_OF_WEEK = [
  { id: 1, name: "Segunda", fullName: "Segunda-feira" },
  { id: 2, name: "Terça", fullName: "Terça-feira" },
  { id: 3, name: "Quarta", fullName: "Quarta-feira" },
  { id: 4, name: "Quinta", fullName: "Quinta-feira" },
  { id: 5, name: "Sexta", fullName: "Sexta-feira" },
  { id: 6, name: "Sábado", fullName: "Sábado" },
  { id: 0, name: "Domingo", fullName: "Domingo" },
];

export default function D3WeeklyActivityHeatmap({
  orders,
  onSelectOrder,
  onOpenMetricModal
}: D3WeeklyActivityHeatmapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCell, setSelectedCell] = useState<{ dayId: number; periodId: number } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ dayName: string; periodName: string; count: number; x: number; y: number } | null>(null);

  // Categories list
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(orders.map(o => o.category))).filter(Boolean);
  }, [orders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (categoryFilter !== "all" && o.category !== categoryFilter) return false;
      if (statusFilter === "active" && (o.status === "concluido" || o.status === "cancelado")) return false;
      if (statusFilter === "concluido" && o.status !== "concluido") return false;
      return true;
    });
  }, [orders, categoryFilter, statusFilter]);

  // Build matrix data
  const { matrix, maxCount, peakCell } = useMemo(() => {
    const map: Record<string, ServiceOrder[]> = {};
    DAYS_OF_WEEK.forEach(day => {
      TIME_PERIODS.forEach(period => {
        map[`${day.id}-${period.id}`] = [];
      });
    });

    filteredOrders.forEach(o => {
      if (!o.createdAt) return;
      const oDate = new Date(o.createdAt);
      const dayIndex = oDate.getDay();
      const hour = oDate.getHours();

      let periodIndex = 0;
      if (hour >= 0 && hour < 8) periodIndex = 0;
      else if (hour >= 8 && hour < 12) periodIndex = 1;
      else if (hour >= 12 && hour < 18) periodIndex = 2;
      else periodIndex = 3;

      const key = `${dayIndex}-${periodIndex}`;
      if (map[key]) {
        map[key].push(o);
      }
    });

    let maxVal = 0;
    let peak: { dayName: string; periodLabel: string; count: number; orders: ServiceOrder[] } | null = null;

    DAYS_OF_WEEK.forEach(day => {
      TIME_PERIODS.forEach(period => {
        const count = (map[`${day.id}-${period.id}`] || []).length;
        if (count > maxVal) {
          maxVal = count;
          peak = {
            dayName: day.fullName,
            periodLabel: period.label,
            count,
            orders: map[`${day.id}-${period.id}`]
          };
        }
      });
    });

    return { matrix: map, maxCount: maxVal, peakCell: peak };
  }, [filteredOrders]);

  // Render D3 SVG Heatmap with Transitions
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 550;
    const margin = { top: 40, right: 20, bottom: 20, left: 90 };
    const height = 300;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);

    svg.attr("viewBox", `0 0 ${width} ${height}`)
       .attr("width", "100%")
       .attr("height", height);

    let g = svg.select<SVGGElement>("g.heatmap-main-group");
    if (g.empty()) {
      g = svg.append("g")
        .attr("class", "heatmap-main-group")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
      
      g.append("g").attr("class", "x-axis-top");
      g.append("g").attr("class", "y-axis-left");
      g.append("g").attr("class", "cells-group");
    } else {
      g.attr("transform", `translate(${margin.left}, ${margin.top})`);
    }

    // X scale: Time Periods
    const xScale = d3.scaleBand()
      .domain(TIME_PERIODS.map(p => p.rangeName))
      .range([0, innerWidth])
      .padding(0.12);

    // Y scale: Days of week
    const yScale = d3.scaleBand()
      .domain(DAYS_OF_WEEK.map(d => d.name))
      .range([0, innerHeight])
      .padding(0.14);

    // Color Interpolator scale
    const colorScale = d3.scaleSequential()
      .interpolator(d3.interpolatePuBu)
      .domain([0, Math.max(maxCount, 4)]);

    const t = d3.transition().duration(600).ease(d3.easeCubicOut);

    // Top X Axis
    const xAxis = g.select<SVGGElement>("g.x-axis-top");
    xAxis.call(d3.axisTop(xScale));
    xAxis.select(".domain").remove();
    xAxis.selectAll("line").remove();
    xAxis.selectAll("text")
      .attr("font-size", "11px")
      .attr("font-weight", "800")
      .attr("fill", "#475569")
      .attr("dy", "-8px");

    // Left Y Axis
    const yAxis = g.select<SVGGElement>("g.y-axis-left");
    yAxis.call(d3.axisLeft(yScale));
    yAxis.select(".domain").remove();
    yAxis.selectAll("line").remove();
    yAxis.selectAll("text")
      .attr("font-size", "11px")
      .attr("font-weight", "800")
      .attr("fill", "#1E293B")
      .attr("dx", "-8px");

    // Heatmap Cells Data
    interface HeatmapCellDatum {
      dayId: number;
      dayName: string;
      dayFullName: string;
      periodId: number;
      periodRangeName: string;
      periodLabel: string;
      count: number;
      orders: ServiceOrder[];
    }

    const cellsData: HeatmapCellDatum[] = [];
    DAYS_OF_WEEK.forEach(day => {
      TIME_PERIODS.forEach(period => {
        const cellOrders = matrix[`${day.id}-${period.id}`] || [];
        cellsData.push({
          dayId: day.id,
          dayName: day.name,
          dayFullName: day.fullName,
          periodId: period.id,
          periodRangeName: period.rangeName,
          periodLabel: period.label,
          count: cellOrders.length,
          orders: cellOrders
        });
      });
    });

    const cellsGroup = g.select<SVGGElement>("g.cells-group");
    const cellSelection = cellsGroup.selectAll<SVGGElement, HeatmapCellDatum>(".heatmap-cell")
      .data(cellsData, d => `${d.dayId}-${d.periodId}`);

    // ENTER
    const cellEnter = cellSelection.enter()
      .append("g")
      .attr("class", "heatmap-cell")
      .style("cursor", "pointer");

    cellEnter.append("rect")
      .attr("class", "cell-rect")
      .attr("x", d => xScale(d.periodRangeName) || 0)
      .attr("y", d => yScale(d.dayName) || 0)
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("rx", 8)
      .attr("fill", "#F8FAFC")
      .attr("stroke", "#E2E8F0")
      .attr("stroke-width", 1);

    cellEnter.append("text")
      .attr("class", "cell-text")
      .attr("x", d => (xScale(d.periodRangeName) || 0) + xScale.bandwidth() / 2)
      .attr("y", d => (yScale(d.dayName) || 0) + yScale.bandwidth() / 2 + 4)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "900")
      .attr("font-family", "monospace")
      .attr("fill", "#94A3B8")
      .text(d => d.count);

    // MERGE & UPDATE with d3-transition
    const cellMerge = cellEnter.merge(cellSelection);

    cellMerge.select<SVGRectElement>(".cell-rect")
      .attr("x", d => xScale(d.periodRangeName) || 0)
      .attr("y", d => yScale(d.dayName) || 0)
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("stroke", d => {
        const isSel = selectedCell?.dayId === d.dayId && selectedCell?.periodId === d.periodId;
        return isSel ? "#4F46E5" : "#E2E8F0";
      })
      .attr("stroke-width", d => {
        const isSel = selectedCell?.dayId === d.dayId && selectedCell?.periodId === d.periodId;
        return isSel ? 2.5 : 1;
      })
      .transition(t)
      .attr("fill", d => {
        if (d.count === 0) return "#F8FAFC";
        return colorScale(d.count);
      });

    cellMerge.select<SVGTextElement>(".cell-text")
      .attr("x", d => (xScale(d.periodRangeName) || 0) + xScale.bandwidth() / 2)
      .attr("y", d => (yScale(d.dayName) || 0) + yScale.bandwidth() / 2 + 4)
      .transition(t)
      .attr("fill", d => {
        if (d.count === 0) return "#94A3B8";
        return d.count > 3 ? "#FFFFFF" : "#1E293B";
      })
      .text(d => d.count);

    // Interactive Hover & Click
    cellMerge
      .on("mouseenter", function(event, d) {
        const [x, y] = d3.pointer(event, containerRef.current);
        setHoveredCell({
          dayName: d.dayFullName,
          periodName: d.periodRangeName,
          count: d.count,
          x,
          y
        });

        d3.select(this).select(".cell-rect")
          .transition()
          .duration(150)
          .attr("stroke", "#4F46E5")
          .attr("stroke-width", 2.5);
      })
      .on("mousemove", function(event) {
        const [x, y] = d3.pointer(event, containerRef.current);
        setHoveredCell(prev => prev ? { ...prev, x, y } : null);
      })
      .on("mouseleave", function(event, d) {
        setHoveredCell(null);
        const isSel = selectedCell?.dayId === d.dayId && selectedCell?.periodId === d.periodId;
        d3.select(this).select(".cell-rect")
          .transition()
          .duration(150)
          .attr("stroke", isSel ? "#4F46E5" : "#E2E8F0")
          .attr("stroke-width", isSel ? 2.5 : 1);
      })
      .on("click", function(event, d) {
        setSelectedCell({ dayId: d.dayId, periodId: d.periodId });
      });

  }, [matrix, selectedCell, maxCount]);

  // Selected cell orders list
  const selectedCellOrders = useMemo(() => {
    if (!selectedCell) return [];
    return matrix[`${selectedCell.dayId}-${selectedCell.periodId}`] || [];
  }, [matrix, selectedCell]);

  const selectedDayObj = useMemo(() => {
    if (!selectedCell) return null;
    return DAYS_OF_WEEK.find(d => d.id === selectedCell.dayId);
  }, [selectedCell]);

  const selectedPeriodObj = useMemo(() => {
    if (!selectedCell) return null;
    return TIME_PERIODS.find(p => p.id === selectedCell.periodId);
  }, [selectedCell]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
              Mapa de Calor de Demanda Semanal (D3 SVG Heatmap)
            </h3>
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-150">
              D3.js
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium max-w-2xl">
            Concentração de aberturas de chamados por dia da semana e período, facilitando o dimensionamento de escalas técnicas.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-col gap-1 text-left">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Setor</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setSelectedCell(null);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-bold outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">📁 Todos os Setores</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>🔧 {cat}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 text-left">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSelectedCell(null);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-bold outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">📊 Todos os Status</option>
              <option value="active">⏳ Abertos / Em Execução</option>
              <option value="concluido">✅ Apenas Concluídos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: D3 Heatmap Canvas + Drilldown Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: D3 SVG Heatmap */}
        <div ref={containerRef} className="xl:col-span-8 relative min-h-[300px]">
          <svg ref={svgRef} className="w-full h-[300px] overflow-visible" />

          {/* Floating Tooltip */}
          {hoveredCell && (
            <div
              className="absolute z-30 pointer-events-none bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-3 shadow-xl border border-slate-800 text-left text-xs transition-all duration-75 transform -translate-x-1/2 -translate-y-full mb-2"
              style={{ left: `${hoveredCell.x}px`, top: `${hoveredCell.y}px` }}
            >
              <div className="font-extrabold text-indigo-300">
                {hoveredCell.dayName} • {hoveredCell.periodName}
              </div>
              <div className="font-mono text-sm font-black text-white mt-1">
                {hoveredCell.count} chamados registrados
              </div>
            </div>
          )}

          {/* D3 Gradient Legend */}
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider pt-3 border-t border-slate-100 mt-2">
            <span>Baixa Demanda (0)</span>
            <div className="h-2 w-36 rounded-full bg-gradient-to-r from-slate-100 via-indigo-200 to-indigo-800" />
            <span>Pico Crítico ({maxCount}+)</span>
          </div>
        </div>

        {/* Right: Insight & Drill-down List */}
        <div className="xl:col-span-4 bg-slate-50/80 rounded-2xl border border-slate-200/60 p-4 space-y-4 text-left">
          {/* Predictive Insight Box */}
          {peakCell && peakCell.count > 0 && (
            <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1.5 text-xs">
              <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest block flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-indigo-600" /> Insight de Escala D3
              </span>
              <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                Pico semanal registrado às <strong>{peakCell.dayName}s</strong> ({peakCell.periodLabel}) com <strong className="text-indigo-700">{peakCell.count} ordens de serviço</strong>.
              </p>
            </div>
          )}

          {/* Drill-down Header */}
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest font-mono">
              {selectedCell ? `${selectedDayObj?.fullName} (${selectedPeriodObj?.rangeName})` : "Selecione uma Célula"}
            </span>
            {selectedCell && (
              <button
                onClick={() => setSelectedCell(null)}
                className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 font-mono transition cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Order list inside selected cell */}
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {selectedCell ? (
              selectedCellOrders.length > 0 ? (
                selectedCellOrders.map(os => (
                  <div
                    key={os.id}
                    onClick={() => onSelectOrder && onSelectOrder(os)}
                    className="p-2.5 bg-white border border-slate-200 hover:border-indigo-400 rounded-xl transition duration-150 cursor-pointer text-xs"
                  >
                    <div className="flex justify-between items-center gap-1 mb-1">
                      <span className="font-mono text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded">
                        #{os.id}
                      </span>
                      {getPriorityBadge(os.priority)}
                    </div>
                    <h5 className="font-extrabold text-slate-800 truncate">{os.title}</h5>
                    <p className="text-[10px] text-slate-500 truncate">
                      Resp: {os.assignedTo || "Sem atribuição"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Nenhum chamado no período selecionado.
                </div>
              )
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                Clique em qualquer bloco do mapa de calor para visualizar os chamados correspondentes.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

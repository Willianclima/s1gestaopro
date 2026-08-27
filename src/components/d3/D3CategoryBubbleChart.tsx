import React, { useRef, useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import { ServiceOrder } from "../../types";
import { Tag, Sparkles, Filter, Layers, ZoomIn, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";

interface D3CategoryBubbleChartProps {
  orders: ServiceOrder[];
  onSelectCategory?: (category: string, orders: ServiceOrder[]) => void;
  onSelectOrder?: (order: ServiceOrder) => void;
}

interface BubbleNode {
  id: string;
  name: string;
  value: number;
  orders: ServiceOrder[];
  openCount: number;
  runningCount: number;
  waitingCount: number;
  doneCount: number;
  urgentCount: number;
}

interface HierarchyData {
  id: string;
  name: string;
  children?: BubbleNode[];
  value?: number;
}

const CATEGORY_COLORS: Record<string, { bg: string; fill: string; stroke: string; text: string }> = {
  "TI": { bg: "#EEF2FF", fill: "#6366F1", stroke: "#4F46E5", text: "#3730A3" },
  "Mecânica": { bg: "#FEF3C7", fill: "#F59E0B", stroke: "#D97706", text: "#92400E" },
  "Elétrica": { bg: "#FEF9C3", fill: "#EAB308", stroke: "#CA8A04", text: "#854D0E" },
  "Hidráulica": { bg: "#E0F2FE", fill: "#0EA5E9", stroke: "#0284C7", text: "#075985" },
  "Alvenaria": { bg: "#FFEDD5", fill: "#F97316", stroke: "#EA580C", text: "#9A3412" },
  "Pintura": { bg: "#FCE7F3", fill: "#EC4899", stroke: "#DB2777", text: "#9D174D" },
  "Climatização": { bg: "#CCFBF1", fill: "#14B8A6", stroke: "#0D9488", text: "#115E59" },
  "Segurança": { bg: "#FEE2E2", fill: "#EF4444", stroke: "#DC2626", text: "#991B1B" },
  "Geral": { bg: "#F1F5F9", fill: "#64748B", stroke: "#475569", text: "#1E293B" },
};

export default function D3CategoryBubbleChart({
  orders,
  onSelectCategory,
  onSelectOrder
}: D3CategoryBubbleChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [filterMode, setFilterMode] = useState<"all" | "active" | "concluido" | "urgent">("all");
  const [hoveredNode, setHoveredNode] = useState<BubbleNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedBubble, setSelectedBubble] = useState<BubbleNode | null>(null);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (filterMode === "active") return o.status !== "concluido" && o.status !== "cancelado";
      if (filterMode === "concluido") return o.status === "concluido";
      if (filterMode === "urgent") return o.priority === "urgent" || o.priority === "high";
      return true;
    });
  }, [orders, filterMode]);

  // Aggregate category nodes
  const nodesData: BubbleNode[] = useMemo(() => {
    const map = new Map<string, ServiceOrder[]>();
    filteredOrders.forEach(o => {
      const cat = o.category || "Geral";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(o);
    });

    const list: BubbleNode[] = [];
    map.forEach((catOrders, catName) => {
      const openCount = catOrders.filter(o => o.status === "aberto").length;
      const runningCount = catOrders.filter(o => o.status === "em_progresso").length;
      const waitingCount = catOrders.filter(o => o.status === "aguardando").length;
      const doneCount = catOrders.filter(o => o.status === "concluido").length;
      const urgentCount = catOrders.filter(o => o.priority === "urgent" || o.priority === "high").length;

      list.push({
        id: `cat-${catName}`,
        name: catName,
        value: catOrders.length,
        orders: catOrders,
        openCount,
        runningCount,
        waitingCount,
        doneCount,
        urgentCount
      });
    });

    return list.sort((a, b) => b.value - a.value);
  }, [filteredOrders]);

  // Render D3 Bubble Pack Layout with Enter/Update/Exit Transitions
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodesData.length === 0) return;

    const width = containerRef.current.clientWidth || 600;
    const height = 360;

    const svg = d3.select(svgRef.current);
    
    svg.attr("viewBox", `0 0 ${width} ${height}`)
       .attr("width", "100%")
       .attr("height", height);

    // Ensure defs and container groups exist once
    let defs = svg.select<SVGDefsElement>("defs");
    if (defs.empty()) {
      defs = svg.append("defs");
      const filter = defs.append("filter")
        .attr("id", "d3-bubble-glow")
        .attr("x", "-20%")
        .attr("y", "-20%")
        .attr("width", "140%")
        .attr("height", "140%");
      
      filter.append("feGaussianBlur")
        .attr("stdDeviation", "4")
        .attr("result", "blur");
      
      filter.append("feComposite")
        .attr("in", "SourceGraphic")
        .attr("in2", "blur")
        .attr("operator", "over");
    }

    let mainG = svg.select<SVGGElement>("g.main-bubble-container");
    if (mainG.empty()) {
      mainG = svg.append("g")
        .attr("class", "main-bubble-container")
        .attr("transform", "translate(20, 20)");
    }

    // Root hierarchy for pack layout
    const rootData: HierarchyData = { id: "root", name: "root", children: nodesData, value: 0 };
    const root = d3.hierarchy<HierarchyData>(rootData)
      .sum(d => d.value || (d.children ? 0 : 1))
      .sort((a, b) => ((b.value || 0) - (a.value || 0)));

    const pack = d3.pack<HierarchyData>()
      .size([width - 40, height - 40])
      .padding(14);

    const packedRoot = pack(root);

    // Filter out root itself, keeping leaf nodes
    const leaves: d3.HierarchyCircularNode<HierarchyData>[] = packedRoot.leaves().filter(l => l.data.id !== "root");

    const getBubble = (d: d3.HierarchyCircularNode<HierarchyData>): BubbleNode => {
      return d.data as unknown as BubbleNode;
    };

    const t = d3.transition().duration(750).ease(d3.easeCubicInOut);

    // Data-join with unique key per category name
    const nodeSelection = mainG.selectAll<SVGGElement, d3.HierarchyCircularNode<HierarchyData>>(".bubble-node")
      .data(leaves, d => getBubble(d).name);

    // EXIT: Shrink and fade out removed categories
    nodeSelection.exit()
      .transition(t)
      .duration(400)
      .style("opacity", 0)
      .attr("transform", (d: any) => `translate(${d.x}, ${d.y}) scale(0.01)`)
      .remove();

    // ENTER: New categories enter from scale 0
    const nodeEnter = nodeSelection.enter()
      .append("g")
      .attr("class", "bubble-node")
      .attr("transform", d => `translate(${d.x}, ${d.y}) scale(0.01)`)
      .style("cursor", "pointer")
      .style("opacity", 0);

    // Outer ripple/pulse circle for urgent nodes
    nodeEnter.append("circle")
      .attr("class", "pulse-urgent-circle")
      .attr("r", d => d.r + 5)
      .attr("fill", "none")
      .attr("stroke", "#EF4444")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", d => getBubble(d).urgentCount > 0 ? 0.6 : 0)
      .append("animateTransform")
      .attr("attributeName", "transform")
      .attr("type", "rotate")
      .attr("from", "0")
      .attr("to", "360")
      .attr("dur", "12s")
      .attr("repeatCount", "indefinite");

    // Main Bubble Circles
    nodeEnter.append("circle")
      .attr("class", "main-circle")
      .attr("r", d => d.r)
      .attr("fill", d => {
        const cat = getBubble(d).name;
        return CATEGORY_COLORS[cat]?.bg || "#EEF2FF";
      })
      .attr("stroke", d => {
        const cat = getBubble(d).name;
        return CATEGORY_COLORS[cat]?.stroke || "#6366F1";
      })
      .attr("stroke-width", 2.5)
      .attr("filter", d => getBubble(d).urgentCount > 0 ? "url(#d3-bubble-glow)" : "none");

    // Inner small accent badge circle for count
    nodeEnter.append("circle")
      .attr("class", "count-badge")
      .attr("cx", 0)
      .attr("cy", d => d.r > 38 ? -d.r * 0.35 : 0)
      .attr("r", d => Math.min(d.r * 0.32, 18))
      .attr("fill", d => {
        const cat = getBubble(d).name;
        return CATEGORY_COLORS[cat]?.fill || "#6366F1";
      })
      .attr("opacity", 0.95);

    // Number text inside count circle
    nodeEnter.append("text")
      .attr("class", "count-text")
      .attr("x", 0)
      .attr("y", d => d.r > 38 ? -d.r * 0.35 + 4 : 4)
      .attr("text-anchor", "middle")
      .attr("font-size", d => Math.max(9, Math.min(13, d.r * 0.22)))
      .attr("font-weight", "900")
      .attr("fill", "#FFFFFF")
      .attr("font-family", "monospace")
      .text(d => getBubble(d).value);

    // Category Label Text
    nodeEnter.append("text")
      .attr("class", "category-label")
      .attr("x", 0)
      .attr("y", d => d.r > 38 ? d.r * 0.25 : d.r + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", d => Math.max(10, Math.min(13, d.r * 0.22)))
      .attr("font-weight", "800")
      .attr("fill", d => {
        const cat = getBubble(d).name;
        return CATEGORY_COLORS[cat]?.text || "#1E293B";
      })
      .text(d => {
        const name = getBubble(d).name;
        if (d.r < 32 && name.length > 8) return name.slice(0, 7) + "…";
        return name;
      });

    // Sub-label for completion or active
    nodeEnter.append("text")
      .attr("class", "sub-label")
      .attr("x", 0)
      .attr("y", d => d.r * 0.52)
      .attr("text-anchor", "middle")
      .attr("font-size", 9)
      .attr("font-weight", "600")
      .attr("fill", "#64748B")
      .style("display", d => d.r > 45 ? "block" : "none")
      .text(d => {
        const data = getBubble(d);
        return `${data.doneCount} conc • ${data.openCount + data.runningCount} ativ`;
      });

    // MERGE ENTER + UPDATE: Animate to new positions, sizes, and colors
    const nodeMerge = nodeEnter.merge(nodeSelection);

    nodeMerge.transition(t)
      .attr("transform", d => `translate(${d.x}, ${d.y}) scale(1)`)
      .style("opacity", 1);

    nodeMerge.select(".main-circle")
      .transition(t)
      .attr("r", d => d.r)
      .attr("fill", d => {
        const cat = getBubble(d).name;
        return CATEGORY_COLORS[cat]?.bg || "#EEF2FF";
      })
      .attr("stroke", d => {
        const cat = getBubble(d).name;
        return CATEGORY_COLORS[cat]?.stroke || "#6366F1";
      })
      .attr("filter", d => getBubble(d).urgentCount > 0 ? "url(#d3-bubble-glow)" : "none");

    nodeMerge.select(".pulse-urgent-circle")
      .transition(t)
      .attr("r", d => d.r + 5)
      .attr("opacity", d => getBubble(d).urgentCount > 0 ? 0.6 : 0);

    nodeMerge.select(".count-badge")
      .transition(t)
      .attr("cy", d => d.r > 38 ? -d.r * 0.35 : 0)
      .attr("r", d => Math.min(d.r * 0.32, 18))
      .attr("fill", d => {
        const cat = getBubble(d).name;
        return CATEGORY_COLORS[cat]?.fill || "#6366F1";
      });

    nodeMerge.select(".count-text")
      .transition(t)
      .attr("y", d => d.r > 38 ? -d.r * 0.35 + 4 : 4)
      .attr("font-size", d => Math.max(9, Math.min(13, d.r * 0.22)))
      .text(d => getBubble(d).value);

    nodeMerge.select(".category-label")
      .transition(t)
      .attr("y", d => d.r > 38 ? d.r * 0.25 : d.r + 14)
      .attr("font-size", d => Math.max(10, Math.min(13, d.r * 0.22)))
      .text(d => {
        const name = getBubble(d).name;
        if (d.r < 32 && name.length > 8) return name.slice(0, 7) + "…";
        return name;
      });

    nodeMerge.select(".sub-label")
      .transition(t)
      .attr("y", d => d.r * 0.52)
      .style("display", d => d.r > 45 ? "block" : "none")
      .text(d => {
        const data = getBubble(d);
        return `${data.doneCount} conc • ${data.openCount + data.runningCount} ativ`;
      });

    // Interactive Hover & Click Behaviors on merged selection
    nodeMerge
      .on("mouseenter", function(event, d) {
        const data = getBubble(d);
        setHoveredNode(data);
        
        const [x, y] = d3.pointer(event, containerRef.current);
        setTooltipPos({ x, y });

        d3.select(this).select(".main-circle")
          .transition()
          .duration(200)
          .attr("r", d.r * 1.08)
          .attr("stroke-width", 4);
      })
      .on("mousemove", function(event) {
        const [x, y] = d3.pointer(event, containerRef.current);
        setTooltipPos({ x, y });
      })
      .on("mouseleave", function(event, d) {
        setHoveredNode(null);
        setTooltipPos(null);

        d3.select(this).select(".main-circle")
          .transition()
          .duration(250)
          .attr("r", d.r)
          .attr("stroke-width", 2.5);
      })
      .on("click", function(event, d) {
        const data = getBubble(d);
        setSelectedBubble(data);
        if (onSelectCategory) {
          onSelectCategory(data.name, data.orders);
        }
      });

  }, [nodesData]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5 relative">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
              Concentração de Demandas por Categoria (D3 Dynamic Bubble Pack)
            </h3>
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-150">
              D3.js Interativo
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Dimensão das esferas proporcional ao volume de atendimentos. Clique em qualquer categoria para detalhar.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/70 p-1 rounded-2xl border border-slate-200/60 self-start sm:self-auto">
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer ${
              filterMode === "all"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Todas ({orders.length})
          </button>
          <button
            onClick={() => setFilterMode("active")}
            className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer ${
              filterMode === "active"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Ativas
          </button>
          <button
            onClick={() => setFilterMode("concluido")}
            className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer ${
              filterMode === "concluido"
                ? "bg-white text-emerald-700 shadow-xs border border-slate-200/50"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Concluídas
          </button>
          <button
            onClick={() => setFilterMode("urgent")}
            className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer ${
              filterMode === "urgent"
                ? "bg-white text-rose-700 shadow-xs border border-slate-200/50"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            ⚡ Críticas / Urgentes
          </button>
        </div>
      </div>

      {/* D3 Canvas Container */}
      <div ref={containerRef} className="relative min-h-[360px] w-full flex items-center justify-center">
        {nodesData.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <Filter className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-semibold">Nenhuma ordem de serviço encontrada nos critérios selecionados.</p>
          </div>
        ) : (
          <svg ref={svgRef} className="w-full h-[360px] overflow-visible" />
        )}

        {/* Floating D3 Tooltip */}
        {hoveredNode && tooltipPos && (
          <div
            className="absolute z-30 pointer-events-none bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-xl border border-slate-800 text-left min-w-[220px] transition-all duration-75 transform -translate-x-1/2 -translate-y-full mb-3"
            style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <span className="font-extrabold text-xs text-indigo-300">Setor: {hoveredNode.name}</span>
              <span className="bg-indigo-600 text-white font-mono text-[10px] font-black px-2 py-0.5 rounded-full">
                {hoveredNode.value} OS
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-medium">
              <div className="flex items-center justify-between bg-slate-800/60 px-2 py-1 rounded-lg">
                <span className="text-slate-400">Abertas:</span>
                <span className="font-mono text-slate-200 font-bold">{hoveredNode.openCount}</span>
              </div>
              <div className="flex items-center justify-between bg-blue-950/40 border border-blue-900/40 px-2 py-1 rounded-lg">
                <span className="text-blue-300">Executando:</span>
                <span className="font-mono text-blue-200 font-bold">{hoveredNode.runningCount}</span>
              </div>
              <div className="flex items-center justify-between bg-amber-950/40 border border-amber-900/40 px-2 py-1 rounded-lg">
                <span className="text-amber-300">Falta Mat.:</span>
                <span className="font-mono text-amber-200 font-bold">{hoveredNode.waitingCount}</span>
              </div>
              <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-900/40 px-2 py-1 rounded-lg">
                <span className="text-emerald-300">Concluídas:</span>
                <span className="font-mono text-emerald-200 font-bold">{hoveredNode.doneCount}</span>
              </div>
            </div>

            {hoveredNode.urgentCount > 0 && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-[10px] text-rose-300 font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>{hoveredNode.urgentCount} chamado(s) com prioridade ALTA/URGENTE</span>
              </div>
            )}

            <p className="mt-2 text-[9px] text-slate-400 text-center uppercase tracking-wider font-semibold">
              Clique para abrir lista detalhada
            </p>
          </div>
        )}
      </div>

      {/* Footer Category Legend Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-100">
        {nodesData.map(node => {
          const clr = CATEGORY_COLORS[node.name] || { bg: "#F1F5F9", fill: "#6366F1", text: "#1E293B" };
          return (
            <button
              key={node.id}
              onClick={() => onSelectCategory && onSelectCategory(node.name, node.orders)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition hover:scale-105 cursor-pointer"
              style={{ backgroundColor: clr.bg, color: clr.text }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: clr.fill }} />
              <span>{node.name}</span>
              <span className="font-mono text-[10px] opacity-75 font-black ml-0.5">({node.value})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

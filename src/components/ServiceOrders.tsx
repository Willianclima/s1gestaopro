import React, { useState, useRef, useEffect } from "react";
import { useFormDraft } from "../hooks/useFormDraft";
import { ServiceOrder, Client, OSStatus, OSHistoryLog, Professional, CurrentUser, Team, BlockedDate } from "../types";
import { 
  FileText, Search, Plus, User, Calendar, Trash2, Edit2, Play, Eye, X, 
  Check, AlertTriangle, Printer, Package, Settings, PlusCircle, Wrench, RefreshCw, Send, Sparkles, Image, Upload, Download,
  Filter, QrCode, Tag
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { jsPDF } from "jspdf";
import { useToast } from "./ToastContext";
import { motion } from "motion/react";

interface ServiceOrdersProps {
  orders: ServiceOrder[];
  globalOrders?: ServiceOrder[];
  clients: Client[];
  categories: any[];
  professionalsList: Professional[]; // Full list of professionals with specialties
  teams?: Team[];
  onAddOrder: (order: ServiceOrder) => void;
  onUpdateOrder: (order: ServiceOrder) => void;
  onDeleteOrder: (id: string) => void;
  onOpenAiAssistantWithOS?: (os: ServiceOrder) => void;
  currentUser?: CurrentUser;
  blockedDates?: BlockedDate[];
  initialSelectedOrderId?: string | null;
  onClearInitialSelectedOrderId?: () => void;
}

export function getPriorityBadge(priority?: 'low' | 'medium' | 'high' | 'urgent') {
  const prio = priority || 'medium';
  const config = {
    low: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: 'Baixa', dot: 'bg-emerald-500' },
    medium: { bg: 'bg-blue-50 text-blue-700 border-blue-100', label: 'Média', dot: 'bg-blue-500' },
    high: { bg: 'bg-amber-50 text-amber-700 border-amber-100', label: 'Alta', dot: 'bg-amber-500' },
    urgent: { bg: 'bg-red-50 text-red-700 border-red-100', label: 'Urgente', dot: 'bg-red-500' },
  };
  const active = config[prio] || config.medium;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-black border uppercase tracking-wider ${active.bg}`}>
      <span className={`w-1 h-1 rounded-full ${active.dot}`}></span>
      {active.label}
    </span>
  );
}

const OrdersSkeleton = () => (
  <>
    {[1, 2, 3, 4, 5].map((n) => (
      <tr key={n} className="animate-pulse">
        <td className="px-6 py-4 w-12 text-center">
          <div className="h-4 bg-slate-200 rounded w-4 mx-auto" />
        </td>
        <td className="px-6 py-4">
          <div className="h-3.5 bg-slate-200 rounded w-10" />
        </td>
        <td className="px-6 py-4">
          <div className="space-y-2">
            <div className="h-3.5 bg-slate-200 rounded w-48" />
            <div className="h-2.5 bg-slate-200 rounded w-32" />
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="h-5 bg-slate-200 rounded-xl w-24" />
        </td>
        <td className="px-6 py-4">
          <div className="h-5 bg-slate-200 rounded w-20" />
        </td>
        <td className="px-6 py-4">
          <div className="h-5 bg-slate-200 rounded w-36" />
        </td>
        <td className="px-6 py-4">
          <div className="flex justify-center gap-1.5">
            <div className="w-16 h-8 bg-slate-200 rounded-lg" />
          </div>
        </td>
      </tr>
    ))}
  </>
);

// Preset physical problem images for easy testing/illustration
const PRESET_IMAGES = [
  { name: "Cabo Rompido", url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400" },
  { name: "Motor Aquecido", url: "https://images.unsplash.com/photo-1574634534894-89d7576c8259?auto=format&fit=crop&q=80&w=400" },
  { name: "Placa Carbonizada", url: "https://images.unsplash.com/photo-1601524909162-be87252be298?auto=format&fit=crop&q=80&w=400" },
  { name: "Vazamento Interno", url: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=400" }
];

// Preset images of successfully completed tasks
const PRESET_COMPLETED_IMAGES = [
  { name: "Motor Reparado", url: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=400" },
  { name: "Quadro Elétrico Recomposto", url: "https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?auto=format&fit=crop&q=80&w=400" },
  { name: "Ar Condicionado Higienizado", url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=400" },
  { name: "Medição de Voltagem OK", url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=400" }
];

export default function ServiceOrders({ 
  orders, globalOrders, clients, categories, professionalsList, teams, onAddOrder, onUpdateOrder, onDeleteOrder, onOpenAiAssistantWithOS, currentUser, blockedDates = [],
  initialSelectedOrderId, onClearInitialSelectedOrderId
}: ServiceOrdersProps) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [dateFilterType, setDateFilterType] = useState<string>("todos"); // "todos", "hoje", "7dias", "30dias", "personalizado"
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [technicianFilter, setTechnicianFilter] = useState<string>("todos");
  const [priorityFilter, setPriorityFilter] = useState<string>("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [isLoading, setIsLoading] = useState(true);

  // Auto-select order if initialSelectedOrderId is passed (from QR code scan / URL deep link)
  useEffect(() => {
    if (initialSelectedOrderId) {
      // Look in both current filtered orders and global/all orders
      const targetOrder = orders.find(o => o.id === initialSelectedOrderId) || 
                          globalOrders?.find(o => o.id === initialSelectedOrderId);
      if (targetOrder) {
        setSelectedOrder(targetOrder);
        toastInfo(`OS #${initialSelectedOrderId} carregada diretamente pelo link do QR Code.`, "Acesso Direto por QR Code");
        if (onClearInitialSelectedOrderId) {
          onClearInitialSelectedOrderId();
        }
      }
    }
  }, [initialSelectedOrderId, orders, globalOrders, onClearInitialSelectedOrderId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);
  
  // AI Auto-triage states
  const [isTriaging, setIsTriaging] = useState(false);
  const [triageResult, setTriageResult] = useState<{
    recommendedCategory: string;
    priority: string;
    technicalScope: string;
    recommendedAssignee: string;
    whyAssignee: string;
  } | null>(null);

  // Modal controllers
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [isInitiatingService, setIsInitiatingService] = useState(false);
  const [isFlaggingMaterial, setIsFlaggingMaterial] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  
  // New States for Gemini OS Analysis
  const [isAnalyzingOS, setIsAnalyzingOS] = useState(false);
  const [osAnalysisResult, setOsAnalysisResult] = useState<string | null>(null);
  const [osAnalysisError, setOsAnalysisError] = useState<string | null>(null);

  // States for bulk selection and batch updates
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const handleBatchStatusUpdate = (newStatus: 'aberto' | 'em_progresso' | 'aguardando' | 'concluido' | 'cancelado') => {
    if (selectedOrderIds.length === 0) return;

    let successCount = 0;
    selectedOrderIds.forEach(id => {
      const os = orders.find(o => o.id === id);
      if (os) {
        const updatedOrder: ServiceOrder = {
          ...os,
          status: newStatus,
          endDate: newStatus === "concluido" ? new Date().toISOString().split("T")[0] : os.endDate,
          history: [
            ...os.history,
            {
              id: "h-" + Math.random().toString(36).substr(2, 9),
              status: newStatus,
              comment: `ATUALIZAÇÃO EM LOTE (BATCH): Status alterado em lote para "${
                newStatus === "concluido" ? "Concluído" :
                newStatus === "em_progresso" ? "Em Execução" :
                newStatus === "aguardando" ? "Aguardando Material" :
                newStatus === "aberto" ? "Aberto / Pendente" : "Cancelado"
              }" por um Gestor.`,
              date: new Date().toISOString(),
              author: "atendente"
            }
          ]
        };
        onUpdateOrder(updatedOrder);
        successCount++;
      }
    });

    toastSuccess(`${successCount} ordens de serviço foram atualizadas para "${
      newStatus === "concluido" ? "Concluído" :
      newStatus === "em_progresso" ? "Em Execução" :
      newStatus === "aguardando" ? "Aguardando Material" :
      newStatus === "aberto" ? "Aberto / Pendente" : "Cancelado"
    }" com sucesso!`, "Atualização em Lote");
    setSelectedOrderIds([]);
  };

  // Clear selection if any filter changes
  useEffect(() => {
    setSelectedOrderIds([]);
  }, [searchTerm, statusFilter, dateFilterType, startDateFilter, endDateFilter, technicianFilter, priorityFilter, categoryFilter]);

  useEffect(() => {
    setOsAnalysisResult(null);
    setOsAnalysisError(null);
    setIsAnalyzingOS(false);
  }, [selectedOrder?.id]);
  
  // New States for Completed service flow including photographs
  const [isCompletingService, setIsCompletingService] = useState(false);
  const [completionImages, setCompletionImages] = useState<string[]>([]);
  const [completionImageUrlInput, setCompletionImageUrlInput] = useState("");
  const completionFileInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<OSStatus>("aberto");
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [serviceLocation, setServiceLocation] = useState("");
  const [locationSearchResults, setLocationSearchResults] = useState<{ id: string; display: string; full: string }[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [cepError, setCepError] = useState("");
  
  // Auxiliary image URL input
  const [imageUrlInput, setImageUrlInput] = useState("");

  // Status Log helpers in details modal (interactive responsiveness before and after initiation)
  const [newLogComment, setNewLogComment] = useState("");
  const [responderRole, setResponderRole] = useState<'atendente' | 'profissional'>('atendente');

  // Initiate technical choice states
  const [selectedProfName, setSelectedProfName] = useState("");

  // Flag material states
  const [missingMaterialText, setMissingMaterialText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    hasDraft,
    draftTimestamp,
    lastSaved,
    restoreDraft,
    discardDraft,
    clearDraftOnSubmit,
  } = useFormDraft(
    isFormOpen,
    editingOrder ? editingOrder.id : null,
    {
      clientId,
      title,
      description,
      category,
      status,
      priority,
      assignedTo,
      startDate,
      endDate,
      notes,
      previewImages,
      serviceLocation,
    },
    (draft) => {
      setClientId(draft.clientId);
      setTitle(draft.title);
      setDescription(draft.description);
      setCategory(draft.category);
      setStatus(draft.status as any);
      setPriority(draft.priority);
      setAssignedTo(draft.assignedTo);
      setStartDate(draft.startDate);
      setEndDate(draft.endDate);
      setNotes(draft.notes);
      setPreviewImages(draft.previewImages);
      setServiceLocation(draft.serviceLocation);
    }
  );

  const getClientName = (id: string) => {
    const c = clients.find(cl => cl.id === id);
    return c ? c.name : "Requisitante Desconhecido";
  };

  const getClientObj = (id: string) => {
    return clients.find(cl => cl.id === id);
  };

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"visual" | "pdf">("visual");

  const asciiOnly = (str: string) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const generateOrderPDF = (order: ServiceOrder, client: Client | undefined) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Header (Banner/Logo)
    doc.setFillColor(15, 23, 42); // slate-900 background for top header
    doc.rect(0, 0, 210, 38, 'F');

    // App Logo text
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.text("REQUISICAOPRO", 15, 16);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(156, 163, 175); // light gray
    doc.text("SISTEMA DE GESTAO TECNICA INTEGRADA", 15, 22);
    doc.text("SUSTENTABILIDADE E EFICIENCIA OPERACIONAL", 15, 26);

    // Badge containing OS ID
    doc.setFillColor(79, 70, 229); // Indigo badge for order ID
    doc.roundedRect(145, 10, 50, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`REQUISICAO`, 170, 15, { align: "center" });
    doc.setFontSize(11);
    doc.text(`#${order.id}`, 170, 21, { align: "center" });

    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} as ${new Date().toLocaleTimeString("pt-BR")}`, 145, 30);

    // 2. Sections Setup
    let currentY = 48;

    // Title of the report
    doc.setFillColor(241, 245, 249);
    doc.rect(15, currentY, 180, 8, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(15, currentY, 180, 8, 'S');
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("VIA DE ATENDIMENTO TECNICO / FICHA DE EXECUCAO", 105, currentY + 5.5, { align: "center" });

    currentY += 14;

    // Draw Two-Column Section for Client and Technical details
    // Left: Requisitante Details
    doc.setFillColor(248, 250, 252);
    doc.rect(15, currentY, 87, 44, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, currentY, 87, 44, 'S');

    // Title
    doc.setFillColor(226, 232, 240);
    doc.rect(15, currentY, 87, 6, 'F');
    doc.setTextColor(51, 65, 85);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("DADOS DO REQUISITANTE / GESTOR", 18, currentY + 4);

    // Content
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    let detailY = currentY + 11;
    doc.text(`Nome: ${asciiOnly(client?.name || "Desconhecido")}`, 18, detailY);
    detailY += 5;
    doc.text(`Documento: ${asciiOnly(client?.document || "N/A")}`, 18, detailY);
    detailY += 5;
    doc.text(`Perfil: ${client?.userType === "gestor" ? "Gestor" : "Requisitante"}`, 18, detailY);
    detailY += 5;
    doc.text(`Telefone: ${asciiOnly(client?.phone || "Nao cadastrado")}`, 18, detailY);
    detailY += 5;
    const finalAddress = order.location || client?.address || "Nao cadastrado";
    const addressText = doc.splitTextToSize(`End.: ${asciiOnly(finalAddress)}`, 81);
    doc.text(addressText, 18, detailY);

    // Right: Operation Details
    doc.setFillColor(248, 250, 252);
    doc.rect(108, currentY, 87, 44, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(108, currentY, 87, 44, 'S');

    // Title
    doc.setFillColor(226, 232, 240);
    doc.rect(108, currentY, 87, 6, 'F');
    doc.setTextColor(51, 65, 85);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("DADOS MESTRES DA OPERACAO", 111, currentY + 4);

    // Content
    doc.setTextColor(15, 23, 42);
    detailY = currentY + 11;
    doc.text(`Categoria: ${asciiOnly(order.category)}`, 111, detailY);
    detailY += 5;
    
    // Status with a nice visual label
    doc.setFont("Helvetica", "bold");
    doc.text(`Status Atual:`, 111, detailY);
    const statusU = order.status.toUpperCase();
    if (order.status === "concluido") {
      doc.setTextColor(16, 185, 129); // Emerald
    } else if (order.status === "em_progresso") {
      doc.setTextColor(59, 130, 246); // Blue
    } else if (order.status === "aguardando") {
      doc.setTextColor(245, 158, 11); // Amber
    } else {
      doc.setTextColor(100, 116, 139); // Slate
    }
    doc.text(`[ ${statusU} ]`, 130, detailY);
    
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "normal");
    detailY += 5;
    doc.text(`Atribuido Para:`, 111, detailY);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text(`${asciiOnly(order.assignedTo || "Pendente de Alocacao")}`, 132, detailY);
    
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "normal");
    detailY += 5;
    const blockMat = order.hasMissingMaterial ? "SIM (Falta Material)" : "NAO";
    doc.text(`Bloqueado: ${blockMat}`, 111, detailY);
    detailY += 5;
    const dateFormatted = order.endDate ? new Date(order.endDate).toLocaleDateString("pt-BR") : "Nao agendado";
    doc.text(`Previsao de Conclusao: ${dateFormatted}`, 111, detailY);

    currentY += 49;

    // 3. Service details (Title, symptom/problem)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    
    // Estimate height of service description block
    const descLines = doc.splitTextToSize(asciiOnly(order.description), 172);
    const blockHeight = 16 + descLines.length * 4.5 + (order.notes ? 18 : 0);
    
    doc.rect(15, currentY, 180, Math.max(25, blockHeight), 'F');
    doc.rect(15, currentY, 180, Math.max(25, blockHeight), 'S');

    doc.setFillColor(226, 232, 240);
    doc.rect(15, currentY, 180, 6, 'F');
    doc.setTextColor(51, 65, 85);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("SINTOMA INFORMADO / ESCOPO DE SERVICO", 18, currentY + 4);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont("Helvetica", "bold");
    doc.text(`Titulo: ${asciiOnly(order.title)}`, 18, currentY + 11);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(descLines, 18, currentY + 16.5);

    if (order.notes) {
      const notesY = currentY + 16.5 + descLines.length * 4.5 + 2;
      doc.setFillColor(255, 255, 255);
      doc.rect(18, notesY, 174, 12, 'F');
      doc.setDrawColor(241, 245, 249);
      doc.rect(18, notesY, 174, 12, 'S');
      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("NOTAS ADICIONAIS DE CAMPO:", 21, notesY + 4);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      const splitNotes = doc.splitTextToSize(asciiOnly(order.notes), 168);
      doc.text(splitNotes, 21, notesY + 8);
    }

    currentY += Math.max(25, blockHeight) + 8;

    // 4. History / Timeline Log
    if (order.history && order.history.length > 0) {
      if (currentY > 210) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      
      const historyHeight = 8 + order.history.length * 15;
      
      doc.rect(15, currentY, 180, historyHeight, 'F');
      doc.rect(15, currentY, 180, historyHeight, 'S');

      doc.setFillColor(226, 232, 240);
      doc.rect(15, currentY, 180, 6, 'F');
      doc.setTextColor(51, 65, 85);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("HISTORICO DE ALTERACOES & PARECERES TECNICOS", 18, currentY + 4);

      let logY = currentY + 11;
      order.history.forEach((h) => {
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        const dateH = new Date(h.date).toLocaleString("pt-BR");
        doc.text(`[${dateH}] Profissional: ${asciiOnly(h.author)} (Status: ${h.status.toUpperCase()})`, 18, logY);
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const commentLines = doc.splitTextToSize(asciiOnly(h.comment), 172);
        doc.text(commentLines, 18, logY + 4);
        logY += 5 + commentLines.length * 4;
      });

      currentY += historyHeight + 8;
    }

    // 5. Signatures Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 30;
    }
    
    const signatureY = pageHeight - 35;
    doc.setDrawColor(148, 163, 184); // Slate 400
    doc.setLineDashPattern([2, 2], 0);

    // Line left
    doc.line(15, signatureY, 95, signatureY);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`${asciiOnly(order.assignedTo || "Tecnico Responsavel")}`, 55, signatureY + 4, { align: "center" });
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text("ASSINATURA DO PROFISSIONAL RESPONSAVEL", 55, signatureY + 8, { align: "center" });

    // Line right
    doc.line(115, signatureY, 195, signatureY);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`${asciiOnly(client?.name || "Representante do Solicitante")}`, 155, signatureY + 4, { align: "center" });
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text("AUTORIZACAO DO REQUISITANTE / GESTOR", 155, signatureY + 8, { align: "center" });

    return doc;
  };

  React.useEffect(() => {
    if (isPrintPreviewOpen && selectedOrder) {
      const client = getClientObj(selectedOrder.clientId);
      const doc = generateOrderPDF(selectedOrder, client);
      const pdfBlob = doc.output("blob");
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPdfBlobUrl(blobUrl);

      return () => {
        URL.revokeObjectURL(blobUrl);
        setPdfBlobUrl(null);
      };
    }
  }, [isPrintPreviewOpen, selectedOrder]);

  const filteredOrders = orders.filter(os => {
    const clientName = getClientName(os.clientId).toLowerCase();
    const osTitle = os.title.toLowerCase();
    const matchesSearch = osTitle.includes(searchTerm.toLowerCase()) || 
                          clientName.includes(searchTerm.toLowerCase()) || 
                          os.id.includes(searchTerm);
    const matchesStatus = statusFilter === "todos" || os.status === statusFilter;

    // Date filtering based on createdAt
    let matchesDate = true;
    if (os.createdAt) {
      const orderDate = new Date(os.createdAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateFilterType === "hoje") {
        const orderDay = new Date(os.createdAt);
        orderDay.setHours(0, 0, 0, 0);
        matchesDate = orderDay.getTime() === today.getTime();
      } else if (dateFilterType === "7dias") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        matchesDate = orderDate >= sevenDaysAgo;
      } else if (dateFilterType === "30dias") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        matchesDate = orderDate >= thirtyDaysAgo;
      } else if (dateFilterType === "personalizado") {
        if (startDateFilter) {
          const start = new Date(startDateFilter);
          start.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && orderDate >= start;
        }
        if (endDateFilter) {
          const end = new Date(endDateFilter);
          end.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && orderDate <= end;
        }
      }
    }

    // Technician filtering
    let matchesTechnician = true;
    if (technicianFilter === "unassigned") {
      matchesTechnician = !os.assignedTo;
    } else if (technicianFilter !== "todos") {
      matchesTechnician = os.assignedTo === technicianFilter;
    }

    // Priority filtering
    const matchesPriority = priorityFilter === "todos" || (os.priority || "medium") === priorityFilter;

    // Category filtering
    const matchesCategory = categoryFilter === "todos" || os.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesDate && matchesTechnician && matchesPriority && matchesCategory;
  });

  const handleLocationSearch = async (query: string) => {
    if (!query || query.trim().length < 3) {
      setLocationSearchResults([]);
      return;
    }

    setIsSearchingLocation(true);
    try {
      // Direct Brazilian search restricted to Araçatuba, SP
      const fullQuery = `${query}, Araçatuba, SP, Brasil`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&addressdetails=1&countrycodes=br&limit=6`,
        {
          headers: {
            "Accept-Language": "pt-BR,pt;q=0.9"
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        const results = data.map((item: any, idx: number) => {
          const parts = item.display_name.split(",");
          // take up to 4 parts to look cleaner in dropdown
          const shortName = parts.slice(0, 4).join(",").trim();
          return {
            id: item.place_id ? `${item.place_id}-${idx}` : `nom-${idx}-${Math.random()}`,
            display: shortName,
            full: item.display_name
          };
        });
        setLocationSearchResults(results);
      } else {
        throw new Error(`Nominatim responded with status ${response.status}`);
      }
    } catch (err) {
      console.warn("Erro Nominatim (Ativando busca local de Araçatuba):", err);
      // Fallback local search based on well-known Araçatuba neighborhoods and avenues
      const localLocations = [
        "Centro, Araçatuba - SP",
        "Jardim Alvorada, Araçatuba - SP",
        "Guanabara, Araçatuba - SP",
        "Concórdia, Araçatuba - SP",
        "Ipanema, Araçatuba - SP",
        "Umuarama, Araçatuba - SP",
        "Av. Brasília, Araçatuba - SP",
        "Av. Araçás, Araçatuba - SP",
        "Av. Pompeu de Toledo, Araçatuba - SP",
        "Av. João Arruda Brasil, Araçatuba - SP",
        "Av. Saudade, Araçatuba - SP",
        "Jardim Morada dos Nobres, Araçatuba - SP",
        "Pinheiros, Araçatuba - SP",
        "Vila Estádio, Araçatuba - SP",
        "Vila Bandeirantes, Araçatuba - SP",
        "Água Branca, Araçatuba - SP",
        "São Rafael, Araçatuba - SP",
        "Nova York, Araçatuba - SP"
      ];
      const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const filtered = localLocations.filter(loc => {
        const normalizedLoc = loc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalizedLoc.includes(normalizedQuery);
      });

      const results = filtered.map((loc, idx) => ({
        id: `local-fallback-${idx}-${Math.random()}`,
        display: loc,
        full: `${loc}, Brasil`
      }));
      setLocationSearchResults(results);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleCepLookup = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      setCepError("CEP inválido (deve conter 8 dígitos)");
      return;
    }

    setIsSearchingLocation(true);
    setCepError("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (response.ok) {
        const data = await response.json();
        if (data.erro) {
          setCepError("CEP não localizado");
        } else {
          const city = data.localidade || "";
          const uf = data.uf || "";
          const addressString = [
            data.logradouro,
            data.bairro,
            city,
            uf
          ].filter(Boolean).join(", ");
          
          setServiceLocation(addressString);
          setCepError("");

          if (city.toLowerCase() !== "araçatuba" && city.toLowerCase() !== "aracatuba") {
            setCepError(`Aviso: CEP de ${city} - ${uf}. Certifique-se que o serviço é em Araçatuba.`);
          }
        }
      } else {
        setCepError("Falha do webservice ViaCEP");
      }
    } catch (err) {
      console.error("ViaCEP error:", err);
      setCepError("Erro na busca de CEP");
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleAiTriage = async () => {
    if (!title.trim() || !description.trim()) {
      toastError("Por favor, preencha o Título e o Sintoma do chamado para iniciar a Triagem de IA.", "Dados insuficientes");
      return;
    }
    setIsTriaging(true);
    setTriageResult(null);

    const catsList = categories;
    const profsList = professionalsList.map(p => ({
      name: p.name,
      role: p.role,
      specialty: p.specialty,
      specialties: p.specialties || []
    }));
    const tmsList = (teams || []).map(t => {
      const memberNames = t.memberIds.map(mid => {
        const p = professionalsList.find(prof => prof.id === mid);
        return p ? p.name : "Desconhecido";
      });
      const leader = professionalsList.find(prof => prof.id === t.leaderId);
      return {
        name: t.name,
        leaderName: leader ? leader.name : "Desconhecido",
        members: memberNames
      };
    });

    try {
      const response = await fetch("/api/gemini/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "triage_os",
          title,
          description,
          categoriesList: catsList,
          professionalsList: profsList,
          teamsList: tmsList
        })
      });

      if (!response.ok) {
        let errMsg = "Erro na comunicação com o servidor de inteligência artificial.";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      try {
        const parsed = JSON.parse(data.result);
        setTriageResult({
          recommendedCategory: parsed.recommendedCategory || "",
          priority: parsed.priority || "Média",
          technicalScope: parsed.technicalScope || "",
          recommendedAssignee: parsed.recommendedAssignee || "",
          whyAssignee: parsed.whyAssignee || ""
        });
        toastSuccess("Triagem e análise técnica concluídas com sucesso pela IA!", "Operação Realizada");
      } catch (errParser) {
        console.error("Falha ao analisar resposta da IA em formato JSON:", errParser);
        setTriageResult({
          recommendedCategory: categories[0] || "Geral",
          priority: "Média",
          technicalScope: data.result,
          recommendedAssignee: "Pendente de Alocação",
          whyAssignee: "A IA retornou orientações gerais em vez de uma alocação específica estruturada."
        });
        toastSuccess("Análise técnica concluída! Orientações gerais disponíveis.", "Operação Realizada");
      }
    } catch (err: any) {
      console.error("Erro na autotriagem de IA:", err);
      toastError("Falha na autotriagem de IA: " + (err?.message || err), "Serviço Indisponível");
    } finally {
      setIsTriaging(false);
    }
  };

  const applyTriageResult = () => {
    if (!triageResult) return;

    // Apply category if exists
    if (categories.includes(triageResult.recommendedCategory)) {
      setCategory(triageResult.recommendedCategory);
    } else {
      const matchedCat = categories.find(c => c.toLowerCase() === triageResult.recommendedCategory.toLowerCase());
      if (matchedCat) {
        setCategory(matchedCat);
      }
    }

    // Map priority
    const prioUpper = triageResult.priority.toUpperCase();
    if (prioUpper.includes("CRÍTICA") || prioUpper.includes("URGENTE") || prioUpper.includes("CRITICAL")) {
      setPriority("urgent");
    } else if (prioUpper.includes("ALTA") || prioUpper.includes("HIGH")) {
      setPriority("high");
    } else if (prioUpper.includes("MÉDIA") || prioUpper.includes("MEDIA") || prioUpper.includes("MEDIUM")) {
      setPriority("medium");
    } else {
      setPriority("low");
    }

    const aiBanner = `----------------------------------------\n🤖 AUTO-TRIAGEM COM INTELIGÊNCIA ARTIFICIAL (GEMINI)\n----------------------------------------\n⚡ CRITICIDADE ESTIMADA: ${triageResult.priority.toUpperCase()}\n🛠️ DIAGNÓSTICO E OPERAÇÕES SUGERIDAS:\n${triageResult.technicalScope}\n👥 ALOCAÇÃO RECOMENDADA: ${triageResult.recommendedAssignee}\n💬 JUSTIFICATIVA: ${triageResult.whyAssignee}\n----------------------------------------\n\n`;
    
    setNotes(prev => {
      const cleanedPrev = prev ? prev.replace(/[\s\S]*?----------------------------------------\n\n/g, "") : "";
      return aiBanner + cleanedPrev;
    });

    toastSuccess("Categoria configurada e recomendações adicionadas às Observações Técnicas!", "Sucesso");
  };

  const openForm = (os?: ServiceOrder) => {
    setCepError("");
    setLocationSearchResults([]);
    setTriageResult(null);
    if (os) {
      setEditingOrder(os);
      setClientId(os.clientId);
      setTitle(os.title);
      setDescription(os.description);
      setCategory(os.category);
      setStatus(os.status);
      setPriority(os.priority || "medium");
      setAssignedTo(os.assignedTo);
      setStartDate(os.startDate);
      setEndDate(os.endDate);
      setNotes(os.notes);
      setPreviewImages(os.images || []);
      setServiceLocation(os.location || "");
    } else {
      setEditingOrder(null);
      setClientId(currentUser && currentUser.userType === "requisitante" ? currentUser.id : (clients[0]?.id || ""));
      setTitle("");
      setDescription("");
      setCategory(categories[0] || "");
      setStatus("aberto");
      setPriority("medium");
      setAssignedTo("");
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate("");
      setNotes("");
      setPreviewImages([]);
      setServiceLocation("");
    }
    setIsFormOpen(true);
  };

  // Base64 File Uploader hook
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setPreviewImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleInsertPresetImage = (url: string) => {
    setPreviewImages(prev => [...prev, url]);
  };

  const handleAddImageUrlInput = () => {
    if (imageUrlInput.trim()) {
      setPreviewImages(prev => [...prev, imageUrlInput.trim()]);
      setImageUrlInput("");
    }
  };

  const handleRemoveImageIndex = (idx: number) => {
    setPreviewImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !title.trim()) return;

    if (editingOrder) {
      const updatedOS: ServiceOrder = {
        ...editingOrder,
        clientId,
        title,
        description,
        category,
        status,
        priority,
        assignedTo,
        startDate,
        endDate: endDate || startDate,
        notes,
        location: serviceLocation,
        images: previewImages
      };
      
      if (editingOrder.status !== status) {
        updatedOS.history = [
          ...editingOrder.history,
          {
            id: "h-" + Math.random().toString(36).substr(2, 9),
            status: status,
            comment: `Status de requisição alterado manualmente na edição para: ${status}`,
            date: new Date().toISOString(),
            author: "atendente"
          }
        ];
      }
      
      onUpdateOrder(updatedOS);
    } else {
      const ordersForIdCalc = globalOrders || orders;
      const numericIds = ordersForIdCalc
        .map(o => parseInt(o.id.replace("req-", ""), 10))
        .filter(num => !isNaN(num));
      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 1000;
      const newOSId = "req-" + (maxId + 1);
      const newOS: ServiceOrder = {
        id: newOSId,
        clientId,
        title,
        description,
        category,
        status: "aberto", // Default is open
        priority,
        assignedTo: "", // Start unassigned
        startDate,
        endDate: endDate || startDate,
        notes,
        location: serviceLocation,
        createdAt: new Date().toISOString(),
        images: previewImages,
        hasMissingMaterial: false,
        history: [
          {
            id: "h-init",
            status: "aberto",
            comment: "Requisição cadastrada e aguardando triagem técnico-operacional.",
            date: new Date().toISOString(),
            author: "atendente"
          }
        ]
      };
      onAddOrder(newOS);
    }

    setIsFormOpen(false);
    setEditingOrder(null);
    clearDraftOnSubmit();
  };

  // Attendant / Professional message reply thread interaction (antes e depois de iniciar)
  const handleAddResponsiveReply = () => {
    if (!selectedOrder || !newLogComment.trim()) return;

    const newLog: OSHistoryLog = {
      id: "h-" + Math.random().toString(36).substr(2, 9),
      // keep current status or use same
      status: selectedOrder.status,
      comment: newLogComment,
      date: new Date().toISOString(),
      author: responderRole
    };

    const isAtendente = responderRole === 'atendente';

    const updatedOrder: ServiceOrder = {
      ...selectedOrder,
      history: [...selectedOrder.history, newLog],
      unreadByClient: isAtendente ? false : true,
      unreadByProfessional: isAtendente ? (selectedOrder.assignedTo ? true : false) : false
    };

    onUpdateOrder(updatedOrder);
    setSelectedOrder(updatedOrder);
    setNewLogComment("");
  };

  // INICIAR ATENDIMENTO: List filtered/recommended professionals by specialty compatibility
  const handleOpenInitiateFlow = () => {
    if (!selectedOrder) return;
    // Clear selection so the system forces user to select a professional before starting
    setSelectedProfName("");
    setIsInitiatingService(true);
  };

  const handleConfirmInitiateService = () => {
    if (!selectedOrder || !selectedProfName) return;

    const matchedProf = professionalsList.find(p => p.name === selectedProfName);
    const block = blockedDates.find(b => 
      b.date === selectedOrder.startDate && 
      (
        b.professionalId === "all" || 
        b.type === "holiday" || 
        (matchedProf && b.professionalId === matchedProf.id) || 
        b.professionalId === selectedProfName
      )
    );
    if (block) {
      toastError(`O técnico ${selectedProfName} não pode ser alocado nesta data devido ao bloqueio: "${block.description}"`, "Data Bloqueada");
      return;
    }

    const updatedOrder: ServiceOrder = {
      ...selectedOrder,
      status: "em_progresso",
      assignedTo: selectedProfName,
      history: [
        ...selectedOrder.history,
        {
          id: "h-" + Math.random().toString(36).substr(2, 9),
          status: "em_progresso",
          comment: `Atendimento iniciado. Profissional designado: ${selectedProfName} (${
            professionalsList.find(p => p.name === selectedProfName)?.specialty || "Geral"
          })`,
          date: new Date().toISOString(),
          author: "atendente"
        }
      ]
    };

    onUpdateOrder(updatedOrder);
    setSelectedOrder(updatedOrder);
    setIsInitiatingService(false);
  };

  // SINALIZAR FALTA DE MATERIAL DO CLIENTE
  const handleConfirmMaterialFlag = () => {
    if (!selectedOrder || !missingMaterialText.trim()) return;

    const updatedOrder: ServiceOrder = {
      ...selectedOrder,
      status: "aguardando",
      hasMissingMaterial: true,
      missingMaterialDescription: missingMaterialText,
      history: [
        ...selectedOrder.history,
        {
          id: "h-" + Math.random().toString(36).substr(2, 9),
          status: "aguardando",
          comment: `SINALIZAÇÃO DE FALTA DE MATERIAL: O técnico relatou que o cliente não tem o determinado material e deve providenciar: "${missingMaterialText}" para que seja possível finalizar os serviços.`,
          date: new Date().toISOString(),
          author: "profissional"
        }
      ]
    };

    onUpdateOrder(updatedOrder);
    setSelectedOrder(updatedOrder);
    setIsFlaggingMaterial(false);
    setMissingMaterialText("");
  };

  const handleResolveMaterialFlag = () => {
    if (!selectedOrder) return;

    const updatedOrder: ServiceOrder = {
      ...selectedOrder,
      status: "em_progresso",
      hasMissingMaterial: false,
      missingMaterialDescription: undefined,
      history: [
        ...selectedOrder.history,
        {
          id: "h-" + Math.random().toString(36).substr(2, 9),
          status: "em_progresso",
          comment: `Material fornecido pelo cliente. Retomando a execução dos serviços.`,
          date: new Date().toISOString(),
          author: "atendente"
        }
      ]
    };

    onUpdateOrder(updatedOrder);
    setSelectedOrder(updatedOrder);
  };

  const handleAnalyzeOSWithIA = async () => {
    if (!selectedOrder) return;
    setIsAnalyzingOS(true);
    setOsAnalysisResult(null);
    setOsAnalysisError(null);

    try {
      const response = await fetch("/api/gemini/assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "analyze_os_details",
          title: selectedOrder.title,
          category: selectedOrder.category,
          description: selectedOrder.description || "Nenhum detalhe técnico provido no cadastro.",
        }),
      });

      if (!response.ok) {
        let errMsg = "Erro na comunicação com o servidor de inteligência artificial.";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      if (data.error) {
        setOsAnalysisError(data.error);
      } else {
        setOsAnalysisResult(data.result);
      }
    } catch (err: any) {
      setOsAnalysisError(err.message || "Não foi possível completar a análise de IA.");
    } finally {
      setIsAnalyzingOS(false);
    }
  };

  const parseMarkdownToJSX = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('###')) {
        return (
          <h5 key={idx} className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider mt-4 mb-2 first:mt-0 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-1">
            {trimmed.replace(/^###\s*/, '')}
          </h5>
        );
      }
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        return (
          <p key={idx} className="font-bold text-slate-800 dark:text-slate-100 text-xs mt-2">
            {trimmed.replace(/\*\*/g, '')}
          </p>
        );
      }
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const content = trimmed.replace(/^[-*]\s*/, '');
        // Match bold parts inside the list item
        const parts = content.split('**');
        return (
          <li key={idx} className="list-disc ml-5 text-xs text-slate-600 dark:text-slate-350 leading-relaxed py-0.5">
            {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold text-slate-800 dark:text-slate-150">{part}</strong> : part)}
          </li>
        );
      }
      if (trimmed === "") {
        return <div key={idx} className="h-1.5" />;
      }
      
      // Normal line, check for bold text inside it
      const parts = line.split('**');
      return (
        <p key={idx} className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-medium">
          {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold text-slate-800 dark:text-slate-150">{part}</strong> : part)}
        </p>
      );
    });
  };

  const handleMarkAsCompleted = () => {
    if (!selectedOrder) return;
    // Open the photo attachment completion sub-section
    setIsCompletingService(true);
    setCompletionImages([]); // clean previous
  };

  const handleCompletionImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setCompletionImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleInsertCompletionPresetImage = (url: string) => {
    setCompletionImages(prev => [...prev, url]);
  };

  const handleAddCompletionImageUrlInput = () => {
    if (completionImageUrlInput.trim()) {
      setCompletionImages(prev => [...prev, completionImageUrlInput.trim()]);
      setCompletionImageUrlInput("");
    }
  };

  const handleRemoveCompletionImageIndex = (idx: number) => {
    setCompletionImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmCompletionWithPhoto = () => {
    if (!selectedOrder) return;

    const updatedOrder: ServiceOrder = {
      ...selectedOrder,
      status: "concluido",
      endDate: new Date().toISOString().split("T")[0],
      completedImages: completionImages.length > 0 ? completionImages : undefined,
      history: [
        ...selectedOrder.history,
        {
          id: "h-" + Math.random().toString(36).substr(2, 9),
          status: "concluido",
          comment: `Atendimento finalizado com êxito.${completionImages.length > 0 ? " Foto(s) de comprovação técnica do serviço concluído anexada(s)." : " Nenhuma foto de finalização fornecida."}`,
          date: new Date().toISOString(),
          author: "profissional"
        }
      ]
    };

    onUpdateOrder(updatedOrder);
    setSelectedOrder(updatedOrder);
    setIsCompletingService(false);
    setCompletionImages([]);
  };

  const handleCancelService = () => {
    if (!selectedOrder) return;
    if (!confirm("Tem certeza que deseja cancelar essa requisição?")) return;

    const updatedOrder: ServiceOrder = {
      ...selectedOrder,
      status: "cancelado",
      history: [
        ...selectedOrder.history,
        {
          id: "h-" + Math.random().toString(36).substr(2, 9),
          status: "cancelado",
          comment: "Requisição cancelada por inviabilidade técnica ou solicitação direta do requisitante.",
          date: new Date().toISOString(),
          author: "atendente"
        }
      ]
    };

    onUpdateOrder(updatedOrder);
    setSelectedOrder(updatedOrder);
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>

      {/* Header controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Requisições de Serviço</h1>
          <p className="text-sm text-slate-500 font-medium">Controle operacional de ordens e chamados técnicos. Sem movimentação financeira.</p>
        </div>

        <button
          onClick={() => openForm()}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-3 px-5 rounded-xl shadow-lg shadow-slate-950/5 active:translate-y-[1px] transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          Nova Abrir Requisição
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              className="w-full text-xs border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-white transition-all font-medium text-slate-700"
              placeholder="Buscar por código, chamados técnicos, diagnóstico ou requisitante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status filters */}
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 gap-1 overflow-x-auto self-start lg:self-auto max-w-full">
            {[
              { id: "todos", label: "Todos os Status" },
              { id: "aberto", label: "Abertos" },
              { id: "em_progresso", label: "Em Execução" },
              { id: "aguardando", label: "Aguardando Material" },
              { id: "concluido", label: "Concluídos" },
              { id: "cancelado", label: "Cancelados" }
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === st.id
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Filters row */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center border-t border-slate-50 pt-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold whitespace-nowrap">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Filtro por Data de Abertura:</span>
          </div>

          {/* Date presets */}
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 gap-1 overflow-x-auto max-w-full">
            {[
              { id: "todos", label: "Qualquer data" },
              { id: "hoje", label: "Hoje" },
              { id: "7dias", label: "Últimos 7 dias" },
              { id: "30dias", label: "Últimos 30 dias" },
              { id: "personalizado", label: "Intervalo Personalizado" }
            ].map(dt => (
              <button
                key={dt.id}
                onClick={() => {
                  setDateFilterType(dt.id);
                  if (dt.id !== "personalizado") {
                    setStartDateFilter("");
                    setEndDateFilter("");
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  dateFilterType === dt.id
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {dt.label}
              </button>
            ))}
          </div>

          {/* Custom Date selection fields */}
          {dateFilterType === "personalizado" && (
            <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">De:</span>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-slate-500 bg-white font-semibold text-slate-700"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">Até:</span>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-slate-500 bg-white font-semibold text-slate-700"
                />
              </div>
              {(startDateFilter || endDateFilter) && (
                <button
                  onClick={() => {
                    setStartDateFilter("");
                    setEndDateFilter("");
                  }}
                  className="text-xs font-bold text-red-650 hover:text-red-750 p-1.5 hover:bg-red-50 rounded-lg transition-all"
                  title="Limpar Datas"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          
          {/* Técnico / Profissional Filter */}
          <div className="flex items-center gap-2 pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-500 text-xs font-bold whitespace-nowrap">Técnico:</span>
            <select
              value={technicianFilter}
              onChange={(e) => setTechnicianFilter(e.target.value)}
              className="text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-white text-slate-700 cursor-pointer min-w-[160px] max-w-full"
            >
              <option value="todos">Todos os Técnicos</option>
              <option value="unassigned font-semibold">Sem Técnico (Pendente)</option>
              {professionalsList
                .filter(p => !p.userType || p.userType === "profissional")
                .map(p => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Prioridade Filter */}
          <div className="flex items-center gap-2 pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-500 text-xs font-bold whitespace-nowrap">Prioridade:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-white text-slate-700 cursor-pointer min-w-[140px] max-w-full"
            >
              <option value="todos">Todas</option>
              <option value="urgent">🔴 Urgentes</option>
              <option value="high">🟠 Altas</option>
              <option value="medium">🟡 Médias</option>
              <option value="low">🟢 Baixas</option>
            </select>
          </div>

          {/* Categoria Filter */}
          <div className="flex items-center gap-2 pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0">
            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-500 text-xs font-bold whitespace-nowrap">Categoria:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-white text-slate-700 cursor-pointer min-w-[150px] max-w-full"
            >
              <option value="todos">Todas as Categorias</option>
              {categories && categories.length > 0 ? (
                categories.map((cat: any) => {
                  const catName = typeof cat === 'string' ? cat : (cat.name || String(cat));
                  const catKey = typeof cat === 'string' ? cat : (cat.id || cat.name || String(cat));
                  return (
                    <option key={catKey} value={catName}>
                      {catName}
                    </option>
                  );
                })
              ) : (
                Array.from(new Set(orders.map(o => o.category || "Geral"))).map(catName => (
                  <option key={catName} value={catName}>
                    {catName}
                  </option>
                ))
              )}
            </select>
          </div>
          
          {/* Active filter summary indicators */}
          {(searchTerm || statusFilter !== "todos" || dateFilterType !== "todos" || technicianFilter !== "todos" || priorityFilter !== "todos" || categoryFilter !== "todos") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("todos");
                setDateFilterType("todos");
                setStartDateFilter("");
                setEndDateFilter("");
                setTechnicianFilter("todos");
                setPriorityFilter("todos");
                setCategoryFilter("todos");
              }}
              className="text-xs font-extrabold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-250 bg-slate-50 hover:bg-slate-100 shrink-0 transition-all md:ml-auto cursor-pointer"
            >
              Resetar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Grid List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Bulk Action Panel */}
        {selectedOrderIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-indigo-50/70 border-b border-indigo-100 p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold"
          >
            <div className="flex items-center gap-2 text-indigo-900">
              <span className="bg-indigo-600 text-white font-extrabold px-2.5 py-1 rounded-full text-[10px]">
                {selectedOrderIds.length}
              </span>
              <span>{selectedOrderIds.length === 1 ? "Ordem de Serviço selecionada" : "Ordens de Serviço selecionadas"}</span>
              <button 
                onClick={() => setSelectedOrderIds([])}
                className="text-indigo-600 hover:text-indigo-800 underline ml-2 cursor-pointer font-bold"
              >
                Limpar Seleção
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-slate-600 font-bold whitespace-nowrap">Alterar status em lote para:</span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => handleBatchStatusUpdate("aberto")}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold cursor-pointer hover:border-slate-350 duration-150 shadow-xs"
                >
                  🟡 Aberto
                </button>
                <button
                  onClick={() => handleBatchStatusUpdate("em_progresso")}
                  className="bg-white hover:bg-blue-50 border border-slate-200 text-blue-700 px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold cursor-pointer hover:border-blue-300 duration-150 shadow-xs"
                >
                  🔵 Em Execução
                </button>
                <button
                  onClick={() => handleBatchStatusUpdate("aguardando")}
                  className="bg-white hover:bg-amber-50 border border-slate-200 text-amber-700 px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold cursor-pointer hover:border-amber-300 duration-150 shadow-xs"
                >
                  🟠 Aguardando Material
                </button>
                <button
                  onClick={() => handleBatchStatusUpdate("concluido")}
                  className="bg-white hover:bg-green-50 border border-slate-200 text-green-700 px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold cursor-pointer hover:border-green-300 duration-150 shadow-xs"
                >
                  🟢 Concluído
                </button>
                <button
                  onClick={() => handleBatchStatusUpdate("cancelado")}
                  className="bg-white hover:bg-red-50 border border-slate-200 text-red-700 px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold cursor-pointer hover:border-red-300 duration-150 shadow-xs"
                >
                  🔴 Cancelado
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrderIds(filteredOrders.map(o => o.id));
                      } else {
                        setSelectedOrderIds([]);
                      }
                    }}
                    className="rounded border-slate-350 text-indigo-650 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                  />
                </th>
                <th className="px-6 py-4">ID Requisição</th>
                <th className="px-6 py-4">Serviço Solicitado / Requisitante</th>
                <th className="px-6 py-4">Categoria Técnica</th>
                <th className="px-6 py-4">Status / Alertas</th>
                <th className="px-6 py-4">Técnico Atribuído</th>
                <th className="px-6 py-4 text-center">Atendimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {isLoading ? (
                <OrdersSkeleton />
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((os, index) => {
                  const client = clients.find(cl => cl.id === os.clientId);
                  const prio = os.priority || 'medium';
                  const priorityStripeColor = 
                    prio === 'low' ? 'border-l-emerald-500' :
                    prio === 'high' ? 'border-l-amber-500' :
                    prio === 'urgent' ? 'border-l-red-500' :
                    'border-l-blue-500'; // medium
                  return (
                    <motion.tr 
                      key={os.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.25) }}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 w-12 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedOrderIds.includes(os.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrderIds(prev => [...prev, os.id]);
                            } else {
                              setSelectedOrderIds(prev => prev.filter(id => id !== os.id));
                            }
                          }}
                          className="rounded border-slate-350 text-indigo-650 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                        />
                      </td>
                      <td className={`px-6 py-4 font-mono text-slate-400 font-bold border-l-4 ${priorityStripeColor}`}>
                        {os.id}
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-[280px]">
                          <span className="font-bold text-slate-850 text-sm block truncate hover:text-slate-900 duration-150" title={os.title}>
                            {os.title}
                          </span>
                          <div className="text-[11px] text-slate-500 font-medium flex items-center flex-wrap gap-2 mt-1">
                            <span>Requisitante: {client ? client.name : "Desconhecido"}</span>
                            <span className="text-slate-300">•</span>
                            {getPriorityBadge(os.priority)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-xl text-[10px] uppercase font-bold bg-slate-100 text-slate-700">
                          {os.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                            os.status === "concluido" ? "bg-green-100 text-green-800" :
                            os.status === "em_progresso" ? "bg-blue-100 text-blue-800" :
                            os.status === "aguardando" ? "bg-amber-100 text-amber-800" :
                            os.status === "cancelado" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"
                          }`}>
                            {os.status === "concluido" ? "Concluído" :
                             os.status === "em_progresso" ? "Em Execução" :
                             os.status === "aguardando" ? "Aguardando Material" :
                             os.status === "aberto" ? "Aberto / Pendente" : "Cancelado"}
                          </span>

                          {os.hasMissingMaterial && (
                            <span className="bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 animate-pulse">
                              <AlertTriangle className="w-3 h-3" /> Falta Material do Cliente
                            </span>
                          )}

                          {os.unreadByClient && (
                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-105 border-indigo-150 px-1.5 py-0.5 rounded text-[9px] font-extrabold flex items-center gap-0.5 animate-pulse">
                              💬 Parecer do Técnico
                            </span>
                          )}

                          {os.unreadByProfessional && (
                            <span className="bg-slate-150 bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded text-[9px] font-extrabold flex items-center gap-0.5">
                              💬 Retorno do Gestor
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {os.assignedTo ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-slate-700 font-bold">{os.assignedTo}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic font-normal">Aguardando alocação técnica</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => setSelectedOrder(os)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            title="Responder e Ver Histórico"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Interagir</span>
                          </button>

                          <button
                            onClick={() => setSelectedOrder(os)}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors flex items-center justify-center"
                            title="Visualizar QR Code de Acesso"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          {(currentUser?.userType === "gestor" || currentUser?.userType === "admin" || currentUser?.userType === "gestor_servicos") && (
                            <>
                              <button
                                onClick={() => openForm(os)}
                                className="p-2 hover:bg-slate-150 rounded-lg text-slate-400 hover:text-slate-800 transition-colors"
                                title="Editar requisição"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  if(confirm(`Remover permanentemente a requisição ${os.id}?`)) {
                                    onDeleteOrder(os.id);
                                  }
                                }}
                                className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                                title="Deletar permanentemente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                    Nenhuma requisição de serviço registrada ou encontrada com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REQUISITION INTERACTION & RESPONSIVENESS PANEL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between rounded-t-3xl">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-extrabold text-base tracking-tight">{selectedOrder.title}</h3>
                  {getPriorityBadge(selectedOrder.priority)}
                </div>
                <p className="text-xs text-slate-400 font-mono">ID: {selectedOrder.id} | Atribuída: {selectedOrder.assignedTo || 'Não alocado'}</p>
              </div>

              <div className="flex items-center gap-2">
                {onOpenAiAssistantWithOS && (
                  <button
                    onClick={() => {
                      onOpenAiAssistantWithOS(selectedOrder);
                      setSelectedOrder(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                    Gerar WhatsApp IA
                  </button>
                )}

                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Pane */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
              
              {/* Notification Banner */}
              {(selectedOrder.unreadByClient || selectedOrder.unreadByProfessional) && (
                <div className="bg-amber-50 border border-amber-250 border-amber-200/60 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="p-1 px-2.5 bg-amber-500 text-white rounded-full text-[10px] font-extrabold uppercase shrink-0 animate-pulse">PENDENTE</span>
                    <div className="text-xs">
                      {selectedOrder.unreadByClient && (
                        <div>
                          <p className="font-extrabold text-slate-900 text-sm">🔔 Resposta técnica aguardando sua visualização para continuidade!</p>
                          <p className="text-slate-600 mt-1 font-medium">O técnico de campo realizou um parecer/resposta responsiva recente. O gestor ou requisitante precisa conferir para dar prosseguimento ao chamado.</p>
                        </div>
                      )}
                      {selectedOrder.unreadByProfessional && (
                        <div>
                          <p className="font-extrabold text-slate-900 text-sm">🔔 Resposta do Gestor/Requisitante aguardando sua visualização profissional!</p>
                          <p className="text-slate-600 mt-1 font-medium">O gestor central publicou uma mensagem/orientação para o técnico responsável dar continuidade aos trabalhos de campo.</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const updated = {
                        ...selectedOrder,
                        unreadByClient: false,
                        unreadByProfessional: false
                      };
                      onUpdateOrder(updated);
                      setSelectedOrder(updated);
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg w-max self-end uppercase tracking-wider transition-colors shadow-sm"
                  >
                    Marcar Mensagens como Visualizadas
                  </button>
                </div>
              )}
              
              {/* Material shortage Warnings */}
              {selectedOrder.hasMissingMaterial && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-red-800 block">Sinalização de Falta de Material de responsabilidade do Requisitante</span>
                    <p className="text-red-700 mt-1 font-medium">{selectedOrder.missingMaterialDescription}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={handleResolveMaterialFlag}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors text-[10px] uppercase"
                      >
                        Material Fornecido (Retomar Chamado)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Ribbon depending on status */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-semibold">
                  <span>Status Operacional atual: </span>
                  <span className="font-bold uppercase text-slate-800">{selectedOrder.status}</span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {/* Option 1: Initiate service if Status is 'aberto' */}
                  {selectedOrder.status === "aberto" && (
                    <button
                      onClick={handleOpenInitiateFlow}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      Iniciar Atendimento
                    </button>
                  )}

                  {/* Option 2: Flag missing material if Status is 'em_progresso' */}
                  {selectedOrder.status === "em_progresso" && (
                    <>
                      <button
                        onClick={() => setIsFlaggingMaterial(true)}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Sinalizar Falta de Material
                      </button>

                      <button
                        onClick={handleMarkAsCompleted}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Concluir Requisição
                      </button>
                    </>
                  )}

                  {/* Cancel button */}
                  {selectedOrder.status !== "concluido" && selectedOrder.status !== "cancelado" && (
                    <button
                      onClick={handleCancelService}
                      className="bg-white border border-slate-200 text-red-600 hover:bg-red-50 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 font-bold"
                    >
                      <X className="w-3.5 h-3.5" />
                      Inviabilizar Chamado
                    </button>
                  )}

                  {/* Print Technical Ficha button */}
                  <button
                    onClick={() => setIsPrintPreviewOpen(true)}
                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    title="Visualizar e Imprimir Ficha Técnica com dados e profissional responsável"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    Visualizar e Imprimir
                  </button>
                </div>
              </div>

              {/* INITIATE TECHNICAL CHOICE SUB-SECTION */}
              {isInitiatingService && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-4 animate-fade-in text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-indigo-900 block uppercase tracking-wider text-[11px]">Selecione o Profissional Técnico Adequado</span>
                    <button 
                      type="button"
                      onClick={() => setIsInitiatingService(false)} 
                      className="p-1 text-slate-400 hover:text-slate-655 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-indigo-850 bg-indigo-50 border border-indigo-150 p-2.5 rounded-xl font-medium">
                    A requisição pertence à categoria <strong>{selectedOrder.category}</strong>. Selecione um técnico profissional cadastrado abaixo para liberar a abertura do atendimento:
                  </p>

                  <div className="space-y-2">
                    {(() => {
                      const onlyProfs = professionalsList.filter(p => !p.userType || p.userType === "profissional");
                      if (onlyProfs.length === 0) {
                        return (
                          <div className="p-4 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-center font-bold">
                            Nenhum técnico profissional cadastrado no sistema. Vá até a aba "Equipe & Colaboradores" para cadastrar profissionais.
                          </div>
                        );
                      }
                      
                      const getBlockForProfessionalOnDate = (profName: string, profId: string, date: string) => {
                        return blockedDates.find(b => 
                          b.date === date && 
                          (
                            b.professionalId === "all" || 
                            b.type === "holiday" || 
                            b.professionalId === profId || 
                            b.professionalId === profName
                          )
                        );
                      };

                      return onlyProfs.map(prof => {
                        const isRecommended = prof.specialties?.includes(selectedOrder.category) || prof.specialty === selectedOrder.category;
                        const block = getBlockForProfessionalOnDate(prof.name, prof.id, selectedOrder.startDate);
                        const isBlocked = !!block;
                        
                        return (
                          <div 
                            key={prof.id} 
                            onClick={() => {
                              if (isBlocked) {
                                toastError(`Não é possível alocar ${prof.name} em ${selectedOrder.startDate} devido ao bloqueio: "${block.description}"`, "Data Bloqueada");
                                return;
                              }
                              setSelectedProfName(prof.name);
                            }}
                            className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                              isBlocked
                                ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                                : selectedProfName === prof.name 
                                ? "bg-slate-900 border-slate-900 text-white shadow-md ring-2 ring-slate-900/10 cursor-pointer" 
                                : "bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/20 cursor-pointer"
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`font-extrabold block ${isBlocked ? "text-slate-400 line-through" : selectedProfName === prof.name ? "text-white" : "text-slate-850"}`}>
                                  {prof.name}
                                </span>
                                {isBlocked && (
                                  <span className="text-[8px] bg-red-100 text-red-700 border border-red-200 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider shrink-0 no-underline">
                                    🔒 {block.type === "holiday" ? "Feriado" : "Folga"}: {block.description}
                                  </span>
                                )}
                              </div>
                              <span className={`text-[10px] font-semibold block mt-0.5 ${isBlocked ? "text-slate-400" : selectedProfName === prof.name ? "text-slate-300" : "text-slate-500"}`}>
                                {prof.role} | {prof.specialties && prof.specialties.length > 0 ? `Especialidades: ${prof.specialties.join(", ")}` : `Especialidade: ${prof.specialty}`}
                              </span>
                            </div>

                            {isRecommended && !isBlocked && (
                              <span className={`font-black text-[9px] px-2 py-0.5 rounded-lg tracking-wider shrink-0 ${
                                selectedProfName === prof.name 
                                  ? "bg-emerald-600 border border-emerald-500 text-white" 
                                  : "bg-indigo-100 border border-indigo-200 text-indigo-700 animate-pulse"
                              }`}>
                                💡 RECOMENDADO
                              </span>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-indigo-100">
                    <button
                      type="button"
                      onClick={() => setIsInitiatingService(false)}
                      className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmInitiateService}
                      className={`px-4 py-1.5 rounded-lg font-bold transition-all ${
                        selectedProfName 
                          ? "bg-slate-900 hover:bg-slate-800 text-white shadow-md cursor-pointer" 
                          : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                      }`}
                      disabled={!selectedProfName}
                    >
                      Alocar Técnico & Iniciar Atendimento
                    </button>
                  </div>
                </div>
              )}

              {/* FLAGGING MISSING MATERIAL SUB-SECTION */}
              {isFlaggingMaterial && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 animate-fade-in text-xs">
                  <span className="font-extrabold text-amber-900 block uppercase tracking-wider text-[11px]">Sinalizar Falta de Material</span>
                  <p className="text-amber-800">
                    Insira abaixo uma descrição do material em falta que o requisitante deve obrigatoriamente comprar para que a equipe possa finalizar o serviço de forma eficaz.
                  </p>

                  <input
                    type="text"
                    className="w-full text-xs border border-amber-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white font-medium text-slate-700"
                    placeholder="Ex: 5 metros de cabo de rede Cat6, Conectores RJ45 blindados, disjuntor bipolar 32A..."
                    value={missingMaterialText}
                    onChange={(e) => setMissingMaterialText(e.target.value)}
                  />

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setIsFlaggingMaterial(false)}
                      className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleConfirmMaterialFlag}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg font-bold"
                      disabled={!missingMaterialText.trim()}
                    >
                      Sinalizar & Pausar OS
                    </button>
                  </div>
                </div>
              )}

              {/* COMPLETING SERVICE PHOTO SUB-SECTION */}
              {isCompletingService && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-4 animate-fade-in text-xs">
                  <span className="font-extrabold text-emerald-900 block uppercase tracking-wider text-[11px] flex items-center gap-1">
                    📷 Anexar Comprovação de Serviço Concluído
                  </span>
                  <p className="text-emerald-800">
                    O atendimento está prestes a ser finalizado. Por favor, acrescente fotos reais da conclusão do trabalho (máquinas reparadas, fiações organizadas, laudo concluído) para registrar como comprovativo documental definitivo.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    {/* Method 1: Local upload */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => completionFileInputRef.current?.click()}
                        className="bg-white border border-emerald-205 hover:bg-emerald-100 text-emerald-900 border-emerald-200 px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs shadow-xs"
                      >
                        <Upload className="w-4 h-4 text-emerald-500" />
                        Escolher Foto do meu Aparelho
                      </button>
                      <input 
                        type="file" 
                        ref={completionFileInputRef}
                        className="hidden" 
                        accept="image/*" 
                        multiple 
                        onChange={handleCompletionImageUpload} 
                      />
                    </div>

                    {/* Method 2: Insert URL */}
                    <div className="flex-1 flex gap-1">
                      <input
                        type="text"
                        className="flex-1 text-xs border border-emerald-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Cole URL da foto concluída..."
                        value={completionImageUrlInput}
                        onChange={(e) => setCompletionImageUrlInput(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleAddCompletionImageUrlInput}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 rounded-xl transition-colors"
                      >
                        Anexar URL
                      </button>
                    </div>
                  </div>

                  {/* Preset completed illustration gallery for fast UI demo */}
                  <div className="pt-1 bg-white/40 p-2 text-slate-700 rounded-lg">
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">Demonstração Rápida: Clique abaixo para usar simulações de serviço concluído:</span>
                    <div className="flex gap-2 flex-wrap">
                      {PRESET_COMPLETED_IMAGES.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleInsertCompletionPresetImage(p.url)}
                          className="bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all flex items-center gap-1"
                        >
                          <Image className="w-2.5 h-2.5 text-emerald-500" />
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Attached completed images list preview */}
                  {completionImages.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 pt-2 bg-white p-2.5 rounded-xl border border-slate-200">
                      {completionImages.map((src, i) => (
                        <div key={i} className="relative rounded-xl border border-slate-100 aspect-video overflow-hidden bg-slate-50 group">
                          <img src={src} className="w-full h-full object-cover" alt="Completion Preview" referrerPolicy="no-referrer" />
                          <button
                            type="button"
                            onClick={() => handleRemoveCompletionImageIndex(i)}
                            className="absolute inset-0 bg-red-950/40 opacity-0 group-hover:opacity-100 text-white font-bold flex items-center justify-center transition-all rounded-xl"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-100 font-bold">
                      ⚠️ Foto Obrigatória: Por favor, adicione pelo menos uma imagem representando o serviço concluído para poder finalizar o atendimento.
                    </p>
                  )}

                  <div className="flex gap-2 justify-end pt-2 border-t border-emerald-100">
                    <button
                      onClick={() => {
                        setIsCompletingService(false);
                        setCompletionImages([]);
                      }}
                      className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold"
                    >
                      Voltar ao Painel
                    </button>
                    <button
                      onClick={handleConfirmCompletionWithPhoto}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg font-extrabold flex items-center gap-1 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={completionImages.length === 0}
                      title={completionImages.length === 0 ? "Adicione pelo menos 1 foto para comprovar" : ""}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Finalizar Atendimento com Fotos ({completionImages.length})
                    </button>
                  </div>
                </div>
              )}

              {/* Client specifications and details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 rounded-2xl border border-slate-200/50 p-4 text-xs font-semibold">
                <div>
                  <h4 className="font-extrabold text-slate-400 text-[10px] uppercase tracking-wider mb-1.5">Tomador do Serviço</h4>
                  <p className="text-slate-800 font-bold text-sm truncate">{getClientName(selectedOrder.clientId)}</p>
                  <p className="text-slate-500 font-normal mt-1">
                    Endereço de atendimento: <span className="text-slate-700 font-bold">{selectedOrder.location || getClientObj(selectedOrder.clientId)?.address || "Não informado"}</span>
                  </p>
                  <p className="text-slate-500 font-normal">
                    Contato: <span className="text-slate-700 font-medium">{getClientObj(selectedOrder.clientId)?.phone || "Sem telefone"}</span>
                  </p>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-400 text-[10px] uppercase tracking-wider mb-1.5">Prazos e Planejamento</h4>
                  <p className="text-slate-800">Iniciado em: {selectedOrder.startDate}</p>
                  <p className="text-slate-500 font-normal mt-1">Previsão estimada de conclusão: <span className="text-slate-700 font-semibold">{selectedOrder.endDate || 'Não predefinido'}</span></p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">Descrição dos Sintomas do Problema relatados</h4>
                <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-xl text-sm font-medium leading-relaxed whitespace-pre-wrap text-slate-600">
                  {selectedOrder.description || "Nenhum detalhe técnico provido no cadastro."}
                </div>
              </div>

              {/* Gemini OS Technical Analysis */}
              <div className="bg-indigo-50/40 dark:bg-slate-900/40 border border-indigo-100/50 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-900 dark:text-indigo-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                      Planejamento Inteligente IA
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                      Analise a descrição desta OS para estimar materiais, ferramentas e o perfil ideal de equipe.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAnalyzeOSWithIA}
                    disabled={isAnalyzingOS}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white font-extrabold text-[11px] uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isAnalyzingOS ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Analisando OS...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                        <span>Sugerir Materiais & Equipe</span>
                      </>
                    )}
                  </button>
                </div>

                {isAnalyzingOS && (
                  <div className="bg-white/80 dark:bg-slate-950/80 rounded-xl p-4 border border-indigo-100/30 dark:border-slate-800 flex flex-col items-center justify-center py-6 text-center space-y-2 animate-pulse">
                    <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">Consultando o Gemini para estruturar o planejamento de campo...</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Isso pode levar alguns segundos de acordo com os detalhes do diagnóstico.</p>
                  </div>
                )}

                {osAnalysisError && (
                  <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-xs font-semibold rounded-xl leading-relaxed">
                    ⚠️ {osAnalysisError}
                  </div>
                )}

                {osAnalysisResult && (
                  <div className="bg-white dark:bg-slate-950 rounded-xl p-4 border border-indigo-100/40 dark:border-slate-800 space-y-3 shadow-2xs max-h-[300px] overflow-y-auto animate-fade-in">
                    <div className="flex items-center justify-between border-b border-indigo-50 dark:border-slate-900 pb-1.5 mb-1">
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Recomendações Geradas por IA</span>
                      <button
                        type="button"
                        onClick={() => setOsAnalysisResult(null)}
                        className="text-[9px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase transition-colors"
                      >
                        Limpar
                      </button>
                    </div>
                    <div className="space-y-3 prose prose-slate dark:prose-invert max-w-none text-left">
                      {parseMarkdownToJSX(osAnalysisResult)}
                    </div>
                  </div>
                )}
              </div>

              {/* QR Code de Acesso Rápido */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs shrink-0 flex items-center justify-center">
                  <QRCodeSVG 
                    id="qr-svg-id"
                    value={`${window.location.origin}${window.location.pathname}?os=${selectedOrder.id}`}
                    size={110}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div className="text-left space-y-1.5 flex-1">
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                    QR Code do Chamado
                  </span>
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-indigo-600 animate-pulse" />
                    Acesso Técnico de Campo
                  </h4>
                  <p className="text-slate-500 text-xs leading-normal">
                    Técnicos em trânsito ou no local podem escanear este QR code para abrir os detalhes operacionais desta ordem de serviço diretamente em seus dispositivos.
                  </p>
                  <div className="pt-1 flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?os=${selectedOrder.id}`);
                        toastSuccess("Link de acesso direto copiado para a área de transferência!", "Sucesso");
                      }}
                      className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[10px] py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      Copiar Link Direto
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const printWindow = window.open("", "_blank");
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>QR Code - OS #${selectedOrder.id}</title>
                                <style>
                                  body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; items-center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #0f172a; text-align: center; }
                                  .card { background: white; padding: 32px; border-radius: 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 350px; }
                                  h2 { margin-top: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.025em; }
                                  p { font-size: 13px; color: #64748b; margin: 8px 0 24px; }
                                  .qr-placeholder { display: inline-block; padding: 16px; background: white; border: 1px solid #e2e8f0; border-radius: 16px; }
                                  .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; font-family: monospace; }
                                </style>
                              </head>
                              <body>
                                <div class="card">
                                  <h2>Ordem de Serviço #${selectedOrder.id}</h2>
                                  <p>${selectedOrder.title}</p>
                                  <div class="qr-placeholder" id="qr-container"></div>
                                  <div class="footer">Araçatuba Serviços de Manutenção</div>
                                </div>
                                <script>
                                  // Fallback to generating image
                                  document.getElementById("qr-container").innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent("${window.location.origin}${window.location.pathname}?os=${selectedOrder.id}") + '" width="180" height="180" />';
                                  window.onload = function() {
                                    window.print();
                                  };
                                </script>
                              </body>
                            </html>
                          `);
                          printWindow.document.close();
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      Imprimir QR Code
                    </button>
                  </div>
                </div>
              </div>

              {/* Attached Photos */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">Fotos Ilustrativas do Problema Anexadas</h4>
                {selectedOrder.images && selectedOrder.images.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedOrder.images.map((imgUrl, i) => (
                      <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-150 aspect-video bg-slate-50">
                        <img 
                          src={imgUrl} 
                          alt={`Problema Ilustrativo ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhuma foto de problemas/entrada anexada a esta requisição.</p>
                )}
              </div>

              {/* Completed Service Proof Photos */}
              {selectedOrder.completedImages && selectedOrder.completedImages.length > 0 && (
                <div className="space-y-3 bg-emerald-50/30 border border-emerald-100 p-4 rounded-2xl">
                  <h4 className="font-extrabold text-emerald-800 text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> Fotos do Serviço Concluído / Comprovante Visual
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedOrder.completedImages.map((imgUrl, i) => (
                      <div key={i} className="relative group rounded-xl overflow-hidden border border-emerald-200 aspect-video bg-white">
                        <img 
                          src={imgUrl} 
                          alt={`Serviço Concluído ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dialogue Response board BEFORE & AFTER initiating service */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Histórico de Respostas Responsivas & Atualizações</h4>
                
                {/* Chat Responsivo Reply box */}
                {selectedOrder.status !== "concluido" && selectedOrder.status !== "cancelado" && (
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 block">Escrever Mensagem Resposta</span>
                      
                      {/* Responder toggle selection */}
                      <div className="flex bg-white border border-slate-200 p-0.5 rounded-lg gap-1">
                        <button
                          type="button"
                          onClick={() => setResponderRole('atendente')}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                            responderRole === "atendente" 
                              ? "bg-slate-900 text-white shadow-xs" 
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Atendente
                        </button>
                        <button
                          type="button"
                          disabled={!selectedOrder.assignedTo}
                          onClick={() => setResponderRole('profissional')}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                            responderRole === "profissional" 
                              ? "bg-slate-900 text-white shadow-xs" 
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                          title={!selectedOrder.assignedTo ? "Atribua um técnico para responder como profissional" : ""}
                        >
                          Técnico Responsável
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/15 bg-white font-medium text-slate-700"
                        placeholder={
                          responderRole === "atendente"
                            ? "Escreva resposta de encaminhamento do atendente..."
                            : `Escreva resposta técnica de ${selectedOrder.assignedTo}...`
                        }
                        value={newLogComment}
                        onChange={(e) => setNewLogComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddResponsiveReply();
                        }}
                      />
                      <button
                        onClick={handleAddResponsiveReply}
                        className="bg-slate-900 hover:bg-slate-800 text-white p-2.5 rounded-xl transition-colors flex items-center justify-center shrink-0"
                        disabled={!newLogComment.trim()}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Response Thread timeline */}
                <div className="space-y-3 pt-2">
                  {selectedOrder.history && selectedOrder.history.length > 0 ? (
                    selectedOrder.history.map((log, idx) => (
                      <div key={log.id || idx} className={`flex flex-col p-3 rounded-2xl border ${
                        log.author === "atendente" 
                          ? "bg-blue-50/40 border-blue-100 mr-8" 
                          : log.author === "profissional"
                          ? "bg-green-50/40 border-green-100 ml-8"
                          : "bg-slate-50/50 border-slate-150"
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            log.author === "atendente" ? "text-blue-700" : log.author === "profissional" ? "text-green-700" : "text-slate-500"
                          }`}>
                            {log.author === 'atendente' ? 'Atendente Respondeu' : log.author === 'profissional' ? 'Técnico Respondeu' : 'Log de Sistema'}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {new Date(log.date).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-xs font-semibold leading-relaxed text-slate-700 whitespace-pre-wrap">
                          {log.comment}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 font-normal">Nenhum evento registrado ainda.</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex justify-between items-center gap-4">
              <button
                type="button"
                onClick={() => setIsPrintPreviewOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider py-3 px-5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir Ficha Técnica
              </button>
              
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider py-3 px-6 rounded-xl hover:bg-slate-100 transition-all shadow-sm cursor-pointer"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE & EDIT FORM DIALOG MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-base">{editingOrder ? "Editar Dados da Requisição" : "Registrar Nova Requisição de Serviço"}</h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                
                {/* NOTIFICATION OF DRAFT EXISTENCE */}
                {hasDraft && draftTimestamp && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex gap-2.5 items-start">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold">Rascunho automático detectado!</p>
                        <p className="text-[10px] text-amber-700 font-medium">
                          Existe um rascunho salvo às {new Date(draftTimestamp).toLocaleTimeString("pt-BR")} de {new Date(draftTimestamp).toLocaleDateString("pt-BR")}. Deseja continuar preenchendo?
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={discardDraft}
                        className="bg-transparent hover:bg-amber-100 text-amber-750 font-extrabold text-[10px] uppercase py-1.5 px-3 rounded-lg transition-colors border border-amber-300"
                      >
                        Descartar
                      </button>
                      <button
                        type="button"
                        onClick={restoreDraft}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] uppercase py-1.5 px-3 rounded-lg transition-colors shadow-xs"
                      >
                        Restaurar
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Client dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Requisitante Associado *</label>
                  <select
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-white transition-all font-semibold text-slate-700 disabled:opacity-75 disabled:bg-slate-100"
                    required
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    disabled={currentUser?.userType === "requisitante"}
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.document || 'Sem Documento'})</option>
                    ))}
                  </select>
                </div>

                {/* Local do Atendimento / Endereço (Araçatuba - SP) */}
                <div className="relative">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Local de Atendimento em Araçatuba - SP *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const client = getClientObj(clientId);
                        if (client && client.address) {
                          setServiceLocation(client.address);
                        }
                      }}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer transition-colors"
                      title="Copiar endereço cadastrado na ficha do requisitante"
                    >
                      Copiar Endereço do Requisitante
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        required
                        className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-semibold text-slate-700"
                        placeholder="CEP (Ex: 16015-000) ou digite parte do endereço em Araçatuba..."
                        value={serviceLocation}
                        onChange={(e) => {
                          const val = e.target.value;
                          setServiceLocation(val);
                          handleLocationSearch(val);
                          // Auto trigger lookup for CEP
                          const numeric = val.replace(/\D/g, "");
                          if (numeric.length === 8) {
                            handleCepLookup(numeric);
                          }
                        }}
                      />
                      {isSearchingLocation && (
                        <div className="absolute right-3.5 top-3">
                          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const numeric = serviceLocation.replace(/\D/g, "");
                        if (numeric.length === 8) {
                          handleCepLookup(numeric);
                        } else if (serviceLocation.trim().length >= 3) {
                          handleLocationSearch(serviceLocation);
                        }
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 rounded-xl transition-colors cursor-pointer"
                    >
                      Buscar
                    </button>
                  </div>

                  {cepError && (
                    <p className="text-[11px] text-red-600 font-bold mt-1 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                      ⚠️ {cepError}
                    </p>
                  )}

                  {/* Nominatim Search Autocomplete List */}
                  {locationSearchResults.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                      <div className="bg-slate-50 px-3 py-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                        Resultados de Araçatuba - SP (Selecione):
                      </div>
                      {locationSearchResults.map((res, idx) => (
                        <button
                          key={`${res.id}-${idx}`}
                          type="button"
                          onClick={() => {
                            setServiceLocation(res.display);
                            setLocationSearchResults([]);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 border-b border-slate-100 last:border-b-0 transition-colors font-medium cursor-pointer"
                        >
                          📍 {res.display}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Aracatuba Quick Neighborhood recommendations */}
                  <div className="flex gap-1.5 flex-wrap items-center mt-2">
                    <span className="text-[9px] text-slate-400 font-bold uppercase mr-1">Sugestões Rápidas:</span>
                    {["Centro, Araçatuba - SP", "Jd. Alvorada, Araçatuba - SP", "Guanabara, Araçatuba - SP", "Concórdia, Araçatuba - SP"].map((neigh, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setServiceLocation(neigh);
                          setLocationSearchResults([]);
                          setCepError("");
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer"
                      >
                        + {neigh.split(",")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Título / Objeto do Serviço *</label>
                  <input
                    type="text"
                    required
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-semibold text-slate-700"
                    placeholder="Ex: Ar condicionado vazando água"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* Description details */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Laudo Inicial de Sintoma (Pelo Requisitante / Atendente) *</label>
                  <textarea
                    rows={4}
                    required
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-medium text-slate-700"
                    placeholder="Descreva detalhadamente o chamado comercial, sintomas indicados ou problema físico..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* AI-powered Auto Triage section */}
                <div className="bg-gradient-to-br from-indigo-50/60 to-slate-50/60 border border-indigo-100 rounded-2xl p-4.5 space-y-3 shadow-xs select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-indigo-900 font-extrabold text-xs uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                      Triagem de IA (Gemini) - Opção 1 Recomendada
                    </div>
                    <span className="text-[8px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black tracking-widest uppercase">
                      Automático
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    A IA pode ler o **título** e os **sintomas** preenchidos acima para classificar automaticamente a categoria técnica correta, determinar a criticidade e indicar o melhor técnico ou equipe disponível no sistema.
                  </p>
                  
                  <button
                    type="button"
                    disabled={isTriaging || !title.trim() || !description.trim()}
                    onClick={handleAiTriage}
                    className={`inline-flex items-center justify-center gap-2 px-4.5 py-2.5 rounded-xl text-xs font-black transition-all ${
                      title.trim() && description.trim()
                        ? "bg-indigo-600 shadow-sm shadow-indigo-600/10 text-white hover:bg-indigo-700 cursor-pointer hover:shadow-md"
                        : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {isTriaging ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                        A IA está analisando & triando o chamado...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                        Autotriage & Diagnóstico com IA
                      </>
                    )}
                  </button>

                  {!title.trim() || !description.trim() ? (
                    <span className="text-[10px] text-slate-400 font-medium block mt-1">
                      💡 Escreva um título e sintoma acima para liberar a Triagem da IA.
                    </span>
                  ) : null}

                  {/* Triage result cards */}
                  {triageResult && (
                    <div className="mt-4 border-t border-indigo-100 pt-3.5 space-y-3 animate-fade-in text-xs">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-150">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">Categoria Sugerida</span>
                          <span className="font-extrabold text-slate-800 flex items-center gap-1 mt-1 text-xs">
                            📂 {triageResult.recommendedCategory || "Indefinida"}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-150">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">Gravidade Estimada</span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-black text-[10px] mt-1.5 uppercase ${
                            triageResult.priority === "Crítica" ? "bg-red-50 text-red-700 border border-red-200" :
                            triageResult.priority === "Alta" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            triageResult.priority === "Média" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                            "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}>
                            🚨 {triageResult.priority}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white p-3.5 rounded-2xl border border-slate-150 space-y-1">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wide">Diagnóstico Preliminar & Escopo sugerido</span>
                        <p className="text-slate-700 font-medium leading-relaxed">{triageResult.technicalScope}</p>
                      </div>

                      <div className="bg-emerald-50/40 border border-emerald-100 p-3.5 rounded-2xl space-y-1">
                        <span className="text-[9px] text-emerald-800 font-extrabold block uppercase tracking-wide">
                          💡 Profissional ou Equipe de Campo Indicada
                        </span>
                        <p className="text-slate-900 font-black text-xs">{triageResult.recommendedAssignee}</p>
                        <p className="text-slate-600 font-normal leading-relaxed text-[11px] mt-1">{triageResult.whyAssignee}</p>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={applyTriageResult}
                          className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] py-3 rounded-xl transition-all cursor-pointer uppercase tracking-wider shadow-sm"
                        >
                          Aplicar Diagnóstico & Categoria
                        </button>
                        <button
                          type="button"
                          onClick={() => setTriageResult(null)}
                          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 text-[11px] font-bold px-3 py-3 rounded-xl transition-all cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Category, Priority & Date constraints */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Categoria do Serviço *</label>
                    <select
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-white transition-all font-semibold text-slate-700"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {categories.map((c, idx) => (
                        <option key={idx} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Prioridade / Urgência *</label>
                    <select
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-white transition-all font-semibold text-slate-700"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                    >
                      <option value="low">🟢 Baixa (Low)</option>
                      <option value="medium">🟡 Média (Medium)</option>
                      <option value="high">🟠 Alta (High)</option>
                      <option value="urgent">🔴 Urgente (Urgent)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Data de Entrada *</label>
                    <input
                      type="date"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-semibold text-slate-700"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* FOTOGRAFIAS ILUSTRATIVAS */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Acrecentar Fotos para Ilustrar o Problema</label>
                  
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    {/* Method 1: Local File upload */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs"
                    >
                      <Upload className="w-4 h-4 text-slate-400" />
                      Escolher do Meu Aparelho
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      accept="image/*" 
                      multiple 
                      onChange={handleImageUpload} 
                    />

                    {/* Method 2: Insert URL */}
                    <div className="flex-1 flex gap-1">
                      <input
                        type="text"
                        className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-1 bg-white font-medium text-slate-700 focus:outline-none"
                        placeholder="Ou cole endereço/URL de imagem..."
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleAddImageUrlInput}
                        className="bg-slate-900 text-white font-bold text-xs px-3 rounded-xl hover:bg-slate-800"
                      >
                        Anexar URL
                      </button>
                    </div>
                  </div>

                  {/* Preset illustration gallery for fast UI demo */}
                  <div className="pt-2">
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">Dica técnica: Selecione abaixo ilustrações típicas para demonstração imediata:</span>
                    <div className="flex gap-2 flex-wrap">
                      {PRESET_IMAGES.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleInsertPresetImage(p.url)}
                          className="bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                        >
                          <Image className="w-3 h-3 text-indigo-500" />
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Attached images preview list */}
                  {previewImages.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 pt-2">
                      {previewImages.map((src, i) => (
                        <div key={i} className="relative rounded-xl border border-slate-200 aspect-video overflow-hidden bg-slate-50 group">
                          <img src={src} className="w-full h-full object-cover" alt="Preview" referrerPolicy="no-referrer" />
                          <button
                            type="button"
                            onClick={() => handleRemoveImageIndex(i)}
                            className="absolute inset-0 bg-red-950/40 opacity-0 group-hover:opacity-100 text-white font-bold flex items-center justify-center transition-all rounded-xl"
                            title="Remover"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Internals / Diagnósticos complementares */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Laudos do Técnico / Observações Secundárias (Opcional)</label>
                  <textarea
                    rows={2}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-medium text-slate-700"
                    placeholder="Instruções adicionais internas..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

              </div>

              {/* Draft auto-save status bar */}
              {lastSaved && (
                <div className="px-6 py-2 bg-slate-100 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Salvamento automático ativo</span>
                  </div>
                  <span>Último rascunho salvo às: {lastSaved.toLocaleTimeString("pt-BR")}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-3.5 rounded-xl hover:bg-slate-100 transition-all shadow-sm"
                >
                  Cancelar Cadastro
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-slate-950/10 transition-all"
                >
                  {editingOrder ? "Atualizar Requisição" : "Registrar Requisição"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECTOR: HIDDEN PRINT PREVIEW DOCUMENT */}
      {selectedOrder && (
        <div id="print-section" className="hidden print:block bg-white p-10 text-black font-sans leading-relaxed text-sm">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-6 mb-6 flex justify-between items-start">
            <div>
              <span className="text-xl font-extrabold uppercase tracking-tight block text-slate-900">RequisiçãoPro</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Sistema de Gestão Técnica Integrada</span>
            </div>
            
            <div className="text-right">
              <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                REQUISIÇÃO #{selectedOrder.id}
              </span>
              <span className="text-[10px] text-slate-500 block font-bold font-mono mt-2">
                Emitido em: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}
              </span>
            </div>
          </div>

          <div className="text-center bg-slate-900 text-white p-2.5 font-bold text-xs uppercase tracking-widest rounded-lg mb-6">
            Via Administrativa de Campo / Ficha de Execução de Serviço
          </div>

          {/* Grid Information: 2 Columns */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Column 1: Client details */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/50">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200/60 pb-1 mb-2">Dados do Requisitante</span>
              {(() => {
                const client = getClientObj(selectedOrder.clientId);
                if (!client) return <p className="text-xs text-slate-500 font-bold">Requisitante Desconhecido</p>;
                return (
                  <div className="space-y-1.5 text-xs font-semibold">
                    <p className="text-slate-900 font-bold">Nome: <span className="font-medium text-slate-700">{client.name}</span></p>
                    <p className="text-slate-900 font-bold">Documento: <span className="font-mono font-medium text-slate-700">{client.document}</span></p>
                    <p className="text-slate-900 font-bold">Telefone: <span className="font-medium text-slate-700">{client.phone}</span></p>
                    <p className="text-slate-900 font-bold">E-mail: <span className="font-medium text-slate-700">{client.email}</span></p>
                    <p className="text-slate-900 font-bold">Endereço: <span className="font-medium text-slate-700">{client.address}</span></p>
                  </div>
                );
              })()}
            </div>

            {/* Column 2: Contract technical specifics */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/50">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200/60 pb-1 mb-2">Dados Técnicos da Operação</span>
              <div className="space-y-1.5 text-xs font-semibold text-slate-900">
                <p className="font-bold">Categoria Técnica: <span className="font-medium text-slate-700">{selectedOrder.category}</span></p>
                <p className="font-bold">Status Atual: <span className="font-extrabold uppercase text-slate-800">{selectedOrder.status}</span></p>
                <p className="font-bold">Profissional Responsável: <span className="font-extrabold text-indigo-700">{selectedOrder.assignedTo || "Pendente de Alocação Técnica"}</span></p>
                <p className="font-bold">Previsão de Conclusão: <span className="font-medium text-slate-700">{selectedOrder.endDate ? new Date(selectedOrder.endDate).toLocaleDateString("pt-BR") : "Não Programado"}</span></p>
                {selectedOrder.hasMissingMaterial && (
                  <p className="text-red-700 font-bold bg-stretch bg-red-50 px-2 py-0.5 rounded text-[11px] border border-red-250 border-red-200/30">
                    ⚠️ BLOQUEADO POR FALTA DE MATERIAL
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Ticket Description details */}
          <div className="border border-slate-200 rounded-xl p-5 space-y-3 mb-6 bg-slate-50/20">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200/60 pb-1">Sintoma Inicial / Escopo Técnico</span>
            <p className="text-xs font-semibold text-slate-800 leading-relaxed font-sans">{selectedOrder.description}</p>
            {selectedOrder.notes && (
              <div className="mt-3 bg-white border border-slate-150 p-3 rounded-lg text-xs">
                <strong className="block text-slate-500 font-bold text-[10px] uppercase mb-1">Notas Gerais</strong>
                <p className="text-slate-650">{selectedOrder.notes}</p>
              </div>
            )}
          </div>

          {/* Historical progression timeline for the auditor */}
          {selectedOrder.history && selectedOrder.history.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-5 space-y-4 mb-8 bg-slate-50/20">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200/60 pb-1">Histórico de Pareceres e Andamentos</span>
              <div className="space-y-3.5 animate-none">
                {selectedOrder.history.map((h, idx) => (
                  <div key={idx} className="text-xs font-semibold border-b border-slate-100 last:border-b-0 pb-2 bg-white p-2.5 rounded-lg border border-slate-250 border-slate-200/45">
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mb-1">
                      <span>Autor: <strong className="text-slate-700 uppercase">{h.author}</strong> | Status: <strong className="text-slate-800 uppercase">{h.status}</strong></span>
                      <span className="font-mono">{new Date(h.date).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-slate-700 font-sans">{h.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photos / Registro Visual do Atendimento na Ficha de Impressão */}
          {((selectedOrder.images && selectedOrder.images.length > 0) || (selectedOrder.completedImages && selectedOrder.completedImages.length > 0)) && (
            <div className="print-break-avoid border border-slate-200 rounded-xl p-5 space-y-4 mb-6 bg-slate-50/10">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200/60 pb-1">Anexo Visual / Fotos do Atendimento</span>
              
              {selectedOrder.images && selectedOrder.images.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Fotos Iniciais / Entrada do Chamado:</h5>
                  <div className="grid grid-cols-3 gap-4">
                    {selectedOrder.images.map((imgUrl, i) => (
                      <div key={i} className="border border-slate-200 rounded-lg overflow-hidden aspect-video bg-white h-28 flex items-center justify-center">
                        <img 
                          src={imgUrl} 
                          alt={`Problema ${i + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.completedImages && selectedOrder.completedImages.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-200/60">
                  <h5 className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Fotos de Conclusão / Comprovantes de Entrega:</h5>
                  <div className="grid grid-cols-3 gap-4">
                    {selectedOrder.completedImages.map((imgUrl, i) => (
                      <div key={i} className="border border-indigo-200 rounded-lg overflow-hidden aspect-video bg-white h-28 flex items-center justify-center">
                        <img 
                          src={imgUrl} 
                          alt={`Conclusão ${i + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Signature margins & confirmation */}
          <div className="mt-16 grid grid-cols-2 gap-10">
            <div className="text-center pt-8 border-t border-dashed border-slate-400 font-semibold text-xs text-slate-800">
              <div className="inline-block w-48 mb-1 leading-none border-b border-slate-400">{selectedOrder.assignedTo || "__________________________"}</div>
              <p className="font-extrabold text-slate-900">Profissional Técnico Responsável</p>
              <p className="text-[10px] text-slate-400 font-mono mt-1">Assinatura / Carimbo</p>
            </div>
            
            <div className="text-center pt-8 border-t border-dashed border-slate-400 font-semibold text-xs text-slate-800">
              <div className="inline-block w-48 mb-1 leading-none border-b border-slate-400">_________________________________</div>
              <p className="font-extrabold text-slate-900">Assinatura do Requisitante / Gestor</p>
              <p className="text-[10px] text-slate-400 font-mono mt-1">Autorização de Conclusão Física</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTOR: VISUAL PRINT PREVIEW DIALOG MODAL ON-SCREEN */}
      {isPrintPreviewOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:hidden">
          <div className="bg-slate-50 rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Visualização da Ficha Técnica</h3>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Print button which triggers window.print() or iframe print depending on mode */}
                <button
                  type="button"
                  onClick={() => {
                    if (previewMode === "pdf") {
                      const iframe = document.getElementById("pdf-iframe") as HTMLIFrameElement;
                      if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.print();
                      } else {
                        window.print();
                      }
                    } else {
                      window.print();
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider py-2 px-4 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-4 h-4 text-indigo-200" />
                  Imprimir Ficha
                </button>

                {pdfBlobUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = pdfBlobUrl;
                      link.download = `requisicao-${selectedOrder.id}-${selectedOrder.title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider py-2 px-4 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                    <Download className="w-4 h-4 text-emerald-200" />
                    Baixar PDF
                  </button>
                )}
                
                <button 
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-700 p-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Fechar visualização"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mode Tabs */}
            <div className="flex gap-4 border-b border-slate-200 bg-white px-6 py-2 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewMode("visual")}
                className={`py-2 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  previewMode === "visual"
                    ? "border-indigo-600 text-indigo-600 font-extrabold"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                }`}
              >
                Ficha Técnica com Fotos (Web)
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("pdf")}
                className={`py-2 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  previewMode === "pdf"
                    ? "border-indigo-600 text-indigo-600 font-extrabold"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                }`}
              >
                Documento Oficial PDF
              </button>
            </div>

            {/* Scrollable Document Area */}
            <div className="p-6 bg-slate-100 flex-1 overflow-y-auto">
              {previewMode === "visual" ? (
                <div className="flex justify-center w-full">
                  <div className="bg-white max-w-[210mm] w-full p-8 md:p-12 shadow-lg border border-slate-200 rounded-2xl text-slate-800 text-sm font-sans space-y-6">
                    
                    {/* Document Header */}
                    <div className="border-b-2 border-slate-900 pb-6 flex justify-between items-start">
                      <div>
                        <span className="text-xl font-extrabold uppercase tracking-tight block text-slate-900">RequisiçãoPro</span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Sistema de Gestão Técnica Integrada</span>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                          REQUISIÇÃO #{selectedOrder.id}
                        </span>
                        <span className="text-[10px] text-slate-500 block font-bold font-mono mt-2">
                          Emitido em: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}
                        </span>
                      </div>
                    </div>

                    <div className="text-center bg-slate-900 text-white p-2.5 font-bold text-xs uppercase tracking-widest rounded-lg">
                      Via Administrativa de Campo / Ficha de Execução de Serviço
                    </div>

                    {/* Grid Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Column 1: Client details */}
                      <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200/60 pb-1 mb-2">Dados do Requisitante</span>
                        {(() => {
                          const client = getClientObj(selectedOrder.clientId);
                          if (!client) return <p className="text-xs text-slate-500 font-bold">Requisitante Desconhecido</p>;
                          return (
                            <div className="space-y-1.5 text-xs font-semibold">
                              <p className="text-slate-900 font-bold">Nome: <span className="font-medium text-slate-700">{client.name}</span></p>
                              <p className="text-slate-900 font-bold">Documento: <span className="font-mono font-medium text-slate-700">{client.document}</span></p>
                              <p className="text-slate-900 font-bold">Telefone: <span className="font-medium text-slate-700">{client.phone}</span></p>
                              <p className="text-slate-900 font-bold">E-mail: <span className="font-medium text-slate-700">{client.email}</span></p>
                              <p className="text-slate-900 font-bold">Endereço: <span className="font-medium text-slate-700">{client.address}</span></p>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Column 2: Contract technical specifics */}
                      <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200/60 pb-1 mb-2">Dados Técnicos da Operação</span>
                        <div className="space-y-1.5 text-xs font-semibold text-slate-900">
                          <p className="font-bold">Categoria Técnica: <span className="font-medium text-slate-700">{selectedOrder.category}</span></p>
                          <p className="font-bold">Status Atual: <span className="font-extrabold uppercase text-slate-800">{selectedOrder.status}</span></p>
                          <p className="font-bold">Profissional Responsável: <span className="font-extrabold text-indigo-700">{selectedOrder.assignedTo || "Pendente de Alocação Técnica"}</span></p>
                          <p className="font-bold">Previsão de Conclusão: <span className="font-medium text-slate-700">{selectedOrder.endDate ? new Date(selectedOrder.endDate).toLocaleDateString("pt-BR") : "Não Programado"}</span></p>
                          {selectedOrder.hasMissingMaterial && (
                            <p className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded text-[11px] border border-red-200/30">
                              ⚠️ BLOQUEADO POR FALTA DE MATERIAL
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ticket Description details */}
                    <div className="border border-slate-200 rounded-xl p-5 space-y-3 bg-slate-50/20">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200/60 pb-1">Sintoma Inicial / Escopo Técnico</span>
                      <p className="text-xs font-bold text-slate-800 leading-relaxed font-sans">{selectedOrder.title}</p>
                      <p className="text-xs font-semibold text-slate-600 leading-relaxed font-sans whitespace-pre-wrap">{selectedOrder.description}</p>
                      {selectedOrder.notes && (
                        <div className="mt-3 bg-white border border-slate-150 p-3 rounded-lg text-xs">
                          <strong className="block text-slate-500 font-bold text-[10px] uppercase mb-1">Notas Gerais</strong>
                          <p className="text-slate-650">{selectedOrder.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Timeline History */}
                    {selectedOrder.history && selectedOrder.history.length > 0 && (
                      <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/20">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200/60 pb-1">Histórico de Pareceres e Andamentos</span>
                        <div className="space-y-3.5">
                          {selectedOrder.history.map((h, idx) => (
                            <div key={idx} className="text-xs font-semibold border-b border-slate-100 last:border-b-0 pb-2 bg-white p-2.5 rounded-lg border border-slate-200/45">
                              <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mb-1">
                                <span>Autor: <strong className="text-slate-700 uppercase">{h.author}</strong> | Status: <strong className="text-slate-800 uppercase">{h.status}</strong></span>
                                <span className="font-mono">{new Date(h.date).toLocaleString("pt-BR")}</span>
                              </div>
                              <p className="text-slate-700 font-sans whitespace-pre-wrap">{h.comment}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Visual Attachments / Photos inside live view */}
                    {((selectedOrder.images && selectedOrder.images.length > 0) || (selectedOrder.completedImages && selectedOrder.completedImages.length > 0)) && (
                      <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/10">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200/60 pb-1">Anexo Visual / Fotos do Atendimento</span>
                        
                        {selectedOrder.images && selectedOrder.images.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Fotos Iniciais / Entrada do Chamado:</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {selectedOrder.images.map((imgUrl, i) => (
                                <div key={i} className="border border-slate-200 rounded-xl overflow-hidden aspect-video bg-slate-100 h-28 flex items-center justify-center">
                                  <img 
                                    src={imgUrl} 
                                    alt={`Problema Inicial ${i + 1}`}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedOrder.completedImages && selectedOrder.completedImages.length > 0 && (
                          <div className="space-y-2 pt-3 border-t border-slate-200/60">
                            <h5 className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Fotos de Conclusão / Comprovantes de Entrega:</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {selectedOrder.completedImages.map((imgUrl, i) => (
                                <div key={i} className="border border-indigo-200 rounded-xl overflow-hidden aspect-video bg-slate-100 h-28 flex items-center justify-center">
                                  <img 
                                    src={imgUrl} 
                                    alt={`Conclusão do Serviço ${i + 1}`}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Signature lines in web view */}
                    <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-10">
                      <div className="text-center pt-8 border-t border-dashed border-slate-400 font-semibold text-xs text-slate-800">
                        <div className="inline-block w-48 mb-1 leading-none border-b border-slate-400">{selectedOrder.assignedTo || "__________________________"}</div>
                        <p className="font-extrabold text-slate-900">Profissional Técnico Responsável</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">Assinatura / Carimbo</p>
                      </div>
                      
                      <div className="text-center pt-8 border-t border-dashed border-slate-400 font-semibold text-xs text-slate-800">
                        <div className="inline-block w-48 mb-1 leading-none border-b border-slate-400">_________________________________</div>
                        <p className="font-extrabold text-slate-900">Assinatura do Requisitante / Gestor</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">Autorização de Conclusão Física</p>
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                pdfBlobUrl ? (
                  <div className="flex justify-center w-full py-4">
                    <div className="bg-white max-w-2xl w-full p-8 md:p-12 shadow-md border border-slate-200 rounded-2xl text-slate-800 text-sm font-sans flex flex-col items-center text-center space-y-6 animate-fade-in">
                      <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                        <FileText className="w-12 h-12" />
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-lg font-extrabold text-slate-800">Documento PDF Pronto para Download</h4>
                        <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                          A ficha técnica oficial da requisição <strong className="text-slate-700">#{selectedOrder.id}</strong> foi compilada e gerada com sucesso contendo todas as assinaturas e informações.
                        </p>
                      </div>

                      {/* PDF Details Grid */}
                      <div className="grid grid-cols-2 gap-4 w-full max-w-md bg-slate-50 p-4 rounded-xl border border-slate-150 text-left text-xs font-semibold text-slate-600">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Formato do Arquivo</p>
                          <p className="text-slate-800 font-bold">PDF Document (.pdf)</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Tamanho Estimado</p>
                          <p className="text-slate-800 font-bold">~120 KB</p>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-slate-200/60 mt-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Certificação Digital</p>
                          <p className="text-indigo-600 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                            Assinado Eletronicamente
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
                        <button
                          type="button"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = pdfBlobUrl;
                            link.download = `requisicao-${selectedOrder.id}-${selectedOrder.title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider py-3.5 px-6 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all"
                        >
                          <Download className="w-4 h-4 text-indigo-200" />
                          Baixar PDF Oficial
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            window.open(pdfBlobUrl, "_blank");
                          }}
                          className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-6 rounded-xl hover:bg-slate-50 transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4 text-slate-400" />
                          Abrir em Nova Guia
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs">
                        * Use a aba <strong className="text-slate-500">Ficha Técnica com Fotos (Web)</strong> para visualizar, interagir e imprimir diretamente sem sair do sistema.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-white rounded-2xl border border-slate-200 min-h-[500px]">
                    <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gerando visualização oficial em formato PDF...</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

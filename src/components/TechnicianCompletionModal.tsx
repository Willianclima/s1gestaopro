import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ClipboardCheck, CheckCircle2, ShieldCheck, AlertCircle, X, Upload, 
  Image as ImageIcon, Pencil, Trash2, User, Calendar, Wrench, 
  CheckSquare, Square, Check, CheckCheck, Sparkles, AlertTriangle
} from "lucide-react";
import { ServiceOrder, Professional, CurrentUser } from "../types";
import { compressImageWithCanvas } from "../utils/imageCompression";
import { useToast } from "./ToastContext";

const PRESET_COMPLETED_IMAGES = [
  { name: "Motor Reparado", url: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=400" },
  { name: "Quadro Elétrico Recomposto", url: "https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?auto=format&fit=crop&q=80&w=400" },
  { name: "Ar Condicionado Higienizado", url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=400" },
  { name: "Medição de Voltagem OK", url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=400" }
];

const PRESET_TECHNICAL_NOTES = [
  "Serviço executado integralmente conforme especificações. Equipamento testado e liberado em perfeito funcionamento.",
  "Manutenção corretiva concluída com substituição de componentes avariados. Testes de carga aprovados sem anomalias.",
  "Instalação e configuração finalizadas com êxito. Requisitante orientado sobre as boas práticas de uso.",
  "Reparo elétrico e estrutural finalizado. Circuito aferido e ambiente limpo e desimpedido."
];

export interface TechnicianCompletionData {
  technicianName: string;
  technicalNotes: string;
  completedImages: string[];
  checklist: {
    serviceExecuted: boolean;
    testedAndOperational: boolean;
    areaCleanAndSafe: boolean;
    clientOriented: boolean;
  };
}

export interface TechnicianCompletionModalProps {
  isOpen: boolean;
  order: ServiceOrder | null;
  clientName?: string;
  professionalsList?: Professional[];
  currentUser?: CurrentUser;
  onClose: () => void;
  onConfirm: (completionData: TechnicianCompletionData) => void;
  onOpenDrawingOverlay?: (imgUrl: string, index: number) => void;
}

export default function TechnicianCompletionModal({
  isOpen,
  order,
  clientName,
  professionalsList = [],
  currentUser,
  onClose,
  onConfirm,
  onOpenDrawingOverlay
}: TechnicianCompletionModalProps) {
  const { toastSuccess, toastWarning } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [technicianName, setTechnicianName] = useState<string>("");
  const [technicalNotes, setTechnicalNotes] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState<string>("");

  // Checklist state
  const [checklist, setChecklist] = useState({
    serviceExecuted: true,
    testedAndOperational: true,
    areaCleanAndSafe: true,
    clientOriented: true
  });

  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Initialize form state whenever the modal opens or order changes
  useEffect(() => {
    if (isOpen && order) {
      // Determine initial technician name
      const initialTech = 
        (currentUser?.userType === "profissional" ? currentUser.name : "") ||
        order.assignedTo ||
        currentUser?.name ||
        "";
      
      setTechnicianName(initialTech);
      setTechnicalNotes("");
      setImages(order.completedImages || []);
      setImageUrlInput("");
      setChecklist({
        serviceExecuted: true,
        testedAndOperational: true,
        areaCleanAndSafe: true,
        clientOriented: true
      });
      setHasAttemptedSubmit(false);
    }
  }, [isOpen, order, currentUser]);

  if (!isOpen || !order) return null;

  const isChecklistComplete = 
    checklist.serviceExecuted && 
    checklist.testedAndOperational && 
    checklist.areaCleanAndSafe;

  const toggleChecklistItem = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAllChecklist = () => {
    setChecklist({
      serviceExecuted: true,
      testedAndOperational: true,
      areaCleanAndSafe: true,
      clientOriented: true
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files) as File[];
    for (const file of fileList) {
      try {
        const compressedUrl = await compressImageWithCanvas(file, {
          maxWidth: 1280,
          maxHeight: 1280,
          quality: 0.75,
          format: "image/jpeg"
        });
        setImages(prev => [...prev, compressedUrl]);
        toastSuccess("Foto de evidência anexada e comprimida!", "Evidência Adicionada");
      } catch (err) {
        console.warn("Fallback FileReader para imagem de conclusão:", err);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            setImages(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
    // Reset file input so re-selecting the same file works
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddImageUrl = () => {
    if (imageUrlInput.trim()) {
      setImages(prev => [...prev, imageUrlInput.trim()]);
      setImageUrlInput("");
      toastSuccess("URL da imagem adicionada!", "Evidência Adicionada");
    }
  };

  const handleRemoveImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddPresetImage = (url: string) => {
    setImages(prev => [...prev, url]);
  };

  const handleApplyPresetNote = (note: string) => {
    setTechnicalNotes(note);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);

    if (!technicianName.trim()) {
      toastWarning("Informe ou selecione o técnico responsável pela validação.", "Técnico Obrigatório");
      return;
    }

    if (!isChecklistComplete) {
      toastWarning(
        "Por favor, certifique-se de marcar os itens obrigatórios do checklist técnico de validação.",
        "Checklist Incompleto"
      );
      return;
    }

    onConfirm({
      technicianName: technicianName.trim(),
      technicalNotes: technicalNotes.trim(),
      completedImages: images,
      checklist
    });
  };

  const formattedDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const formattedTime = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <AnimatePresence>
      <div 
        id="modal-technician-completion-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
      >
        <motion.div
          id="modal-technician-completion-card"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto max-h-[92vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white p-5 px-6 flex items-center justify-between border-b border-emerald-800 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/15 backdrop-blur-xs text-white rounded-2xl border border-white/20 shadow-inner">
                <ClipboardCheck className="w-6 h-6 animate-pulse text-emerald-100" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-lg tracking-tight leading-none text-white">
                    Validação Técnica & Finalização de OS
                  </h3>
                  <span className="bg-emerald-950/40 text-emerald-200 text-[10px] uppercase font-mono px-2 py-0.5 rounded-md font-extrabold border border-emerald-400/30">
                    Conclusão
                  </span>
                </div>
                <p className="text-xs text-emerald-100/90 font-medium mt-1">
                  Confirmação obrigatória do responsável técnico antes de definir a OS como concluída
                </p>
              </div>
            </div>
            <button
              id="btn-close-technician-completion-modal"
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Cancelar e manter em execução"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-slate-700 dark:text-slate-200 flex-1">
            {/* Service Order Overview Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-mono">
                    OS #{order.id}
                  </span>
                  <h4 className="font-black text-slate-900 dark:text-white text-base leading-snug">
                    {order.title}
                  </h4>
                </div>
                <span className="shrink-0 text-[10.5px] font-extrabold px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {order.category}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/60 text-xs">
                <div>
                  <span className="text-slate-400 dark:text-slate-400 font-semibold block text-[11px]">Requisitante:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {clientName || order.clientId}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 font-semibold block text-[11px]">Data / Hora de Finalização:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    {formattedDate} às {formattedTime}
                  </span>
                </div>
              </div>
            </div>

            {/* Technical Validation Notice */}
            <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block mb-0.5">Validação de Responsabilidade Técnica</strong>
                <p className="text-[11.5px] leading-relaxed text-emerald-800 dark:text-emerald-300 font-medium">
                  Ao validar a conclusão, o sistema registrará a finalização oficial do chamado no histórico da OS, liberando a emissão de laudo e informando o requisitante sobre o encerramento do atendimento.
                </p>
              </div>
            </div>

            {/* Technician Identifier */}
            <div className="space-y-1.5">
              <label 
                htmlFor="input-technician-completion-name"
                className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Técnico Responsável pela Validação</span>
                <span className="text-rose-500">*</span>
              </label>

              <div className="flex gap-2">
                <input
                  id="input-technician-completion-name"
                  type="text"
                  required
                  placeholder="Nome do técnico responsável..."
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className={`w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none transition-all ${
                    hasAttemptedSubmit && !technicianName.trim()
                      ? "border-rose-500 ring-2 ring-rose-500/20"
                      : "border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  }`}
                />
              </div>

              {professionalsList && professionalsList.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400">Atribuir rápido:</span>
                  {professionalsList.slice(0, 4).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTechnicianName(p.name)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold transition-all cursor-pointer ${
                        technicianName === p.name
                          ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
                          : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Validation Checklist */}
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Checklist Técnico de Validação
                  <span className="text-rose-500 text-xs">*</span>
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllChecklist}
                  className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Marcar Todos
                </button>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Confirme os quesitos técnicos para certificar a conformidade do encerramento:
              </p>

              <div className="space-y-2 pt-1">
                {/* Item 1 */}
                <label 
                  onClick={() => toggleChecklistItem("serviceExecuted")}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    checklist.serviceExecuted
                      ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200"
                      : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                  }`}
                >
                  <div className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                    {checklist.serviceExecuted ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="text-xs font-semibold leading-snug">
                    <span className="font-extrabold text-slate-900 dark:text-white block">
                      1. Execução Técnica Integral
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-normal">
                      Todos os reparos, manutenções e solicitações descritas na OS foram concluídos integralmente.
                    </span>
                  </div>
                </label>

                {/* Item 2 */}
                <label 
                  onClick={() => toggleChecklistItem("testedAndOperational")}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    checklist.testedAndOperational
                      ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200"
                      : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                  }`}
                >
                  <div className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                    {checklist.testedAndOperational ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="text-xs font-semibold leading-snug">
                    <span className="font-extrabold text-slate-900 dark:text-white block">
                      2. Testes Operacionais Realizados
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-normal">
                      O sistema/equipamento foi acionado e verificado em perfeito funcionamento sem ruídos ou falhas.
                    </span>
                  </div>
                </label>

                {/* Item 3 */}
                <label 
                  onClick={() => toggleChecklistItem("areaCleanAndSafe")}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    checklist.areaCleanAndSafe
                      ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200"
                      : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                  }`}
                >
                  <div className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                    {checklist.areaCleanAndSafe ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="text-xs font-semibold leading-snug">
                    <span className="font-extrabold text-slate-900 dark:text-white block">
                      3. Área Limpa e Desobstruída
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-normal">
                      Ferramentas recolhidas, resíduos descartados e local de intervenção seguro e organizado.
                    </span>
                  </div>
                </label>

                {/* Item 4 (Optional / Recommendation) */}
                <label 
                  onClick={() => toggleChecklistItem("clientOriented")}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    checklist.clientOriented
                      ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200"
                      : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                  }`}
                >
                  <div className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                    {checklist.clientOriented ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="text-xs font-semibold leading-snug">
                    <span className="font-extrabold text-slate-900 dark:text-white block">
                      4. Orientação Técnica ao Usuário/Cliente
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-normal">
                      Instruções de conservação e uso repassadas ao solicitante.
                    </span>
                  </div>
                </label>
              </div>

              {hasAttemptedSubmit && !isChecklistComplete && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1 pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Os itens 1, 2 e 3 do checklist são obrigatórios para validar a finalização.
                </p>
              )}
            </div>

            {/* Technical Notes / Parecer de Conclusão */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label 
                  htmlFor="textarea-technical-notes"
                  className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Parecer Técnico / Observações Finais
                </label>
                <span className="text-[10px] text-slate-400 dark:text-slate-400">Opcional com presets</span>
              </div>

              <textarea
                id="textarea-technical-notes"
                rows={3}
                placeholder="Descreva o que foi reparado, peças substituídas ou observações técnicas sobre o atendimento concluído..."
                value={technicalNotes}
                onChange={(e) => setTechnicalNotes(e.target.value)}
                className="w-full text-xs font-medium p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
              />

              {/* Presets */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 block">Sugestões rápidas de parecer:</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TECHNICAL_NOTES.map((note, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPresetNote(note)}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg font-medium transition-all text-left truncate max-w-xs cursor-pointer"
                      title={note}
                    >
                      💡 {note}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Photos & Evidence Section */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Fotos Comprobatórias de Conclusão ({images.length})
                </span>
                <span className="text-[10.5px] font-bold text-slate-400">
                  {images.length > 0 ? "Comprovantes anexados" : "Opcional / Recomendado"}
                </span>
              </div>

              {/* Attachment Actions */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 px-3.5 py-2 rounded-xl flex items-center justify-center gap-2 font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Anexar Foto da Câmera / Arquivo
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                />

                <div className="flex-1 flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Ou cole a URL da imagem..."
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    className="flex-1 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    className="bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs px-3 py-2 rounded-xl transition-colors shrink-0 cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Presets Gallery for Quick Simulation */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 block mb-1">
                  Exemplos rápidos de comprovação técnica:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COMPLETED_IMAGES.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAddPresetImage(p.url)}
                      className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <ImageIcon className="w-2.5 h-2.5 text-emerald-500" />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Images preview list */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  {images.map((src, i) => (
                    <div 
                      key={i} 
                      className="relative rounded-xl border border-slate-200 dark:border-slate-700 aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800 group shadow-xs"
                    >
                      <img 
                        src={src} 
                        className="w-full h-full object-cover" 
                        alt={`Evidência Conclusão ${i + 1}`} 
                        referrerPolicy="no-referrer" 
                      />
                      <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-all rounded-xl p-1.5 flex items-center justify-center gap-1.5">
                        {onOpenDrawingOverlay && (
                          <button
                            type="button"
                            onClick={() => onOpenDrawingOverlay(src, i)}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                            title="Anotar / Desenhar na foto"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Anotar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(i)}
                          className="p-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded-lg transition-transform active:scale-95 cursor-pointer"
                          title="Remover foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>

          {/* Footer Actions */}
          <div className="bg-slate-50 dark:bg-slate-800/80 p-4 px-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>A OS será arquivada como <strong>Concluída</strong> com data registrada.</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                id="btn-cancel-technician-completion"
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Cancelar (Manter em Execução)
              </button>

              <button
                id="btn-confirm-technician-completion"
                type="button"
                onClick={handleSubmit}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all cursor-pointer active:scale-98"
              >
                <Check className="w-4 h-4" />
                Validar & Finalizar OS
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

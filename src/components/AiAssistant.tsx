import React, { useState } from "react";
import { ServiceOrder, Client } from "../types";
import { Sparkles, Copy, Check, MessageSquare, Send, FileText, Loader2, ClipboardList } from "lucide-react";

interface AiAssistantProps {
  orders: ServiceOrder[];
  clients: Client[];
}

export default function AiAssistant({ orders, clients }: AiAssistantProps) {
  const [activeTab, setActiveTab] = useState<"proposal" | "materials" | "whatsapp">("proposal");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [selectedOSId, setSelectedOSId] = useState("");
  
  // Custom states for WhatsApp generator
  const [whatsappClientName, setWhatsappClientName] = useState("");
  const [whatsappTitle, setWhatsappTitle] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  // Auto-fill WhatsApp state when an OS is selected
  const handleOSSelect = (osId: string) => {
    setSelectedOSId(osId);
    if (!osId) {
      setWhatsappClientName("");
      setWhatsappTitle("");
      setWhatsappPhone("");
      return;
    }
    const os = orders.find(o => o.id === osId);
    if (os) {
      const client = clients.find(c => c.id === os.clientId);
      setWhatsappClientName(client ? client.name : "Requisitante");
      setWhatsappTitle(os.title);
      setWhatsappPhone(client ? client.phone.replace(/\D/g, "") : "");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const executeAction = async () => {
    setLoading(true);
    setResult("");
    try {
      let body: any = { action: "" };

      if (activeTab === "proposal") {
        if (!title.trim()) {
          setResult("⚠️ Por favor, digite o título ou resumo do serviço.");
          setLoading(false);
          return;
        }
        body = {
          action: "draft_description",
          title: title,
          category: category || "Geral"
        };
      } else if (activeTab === "materials") {
        if (!title.trim()) {
          setResult("⚠️ Por favor, digite o título ou resumo do serviço.");
          setLoading(false);
          return;
        }
        body = {
          action: "suggest_materials", // Refactored to technical materials suggestion
          title: title,
          category: category || "Geral"
        };
      } else if (activeTab === "whatsapp") {
        if (!whatsappClientName.trim() || !whatsappTitle.trim()) {
          setResult("⚠️ Por favor, preencha o nome do requisitante e o título do serviço.");
          setLoading(false);
          return;
        }
        body = {
          action: "create_message", // Non-financial client summary message
          clientName: whatsappClientName,
          title: whatsappTitle
        };
      }

      const response = await fetch("/api/gemini/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Falha ao se conectar com o servidor.");
      }

      const data = await response.json();
      if (data.error) {
        setResult(`❌ Erro: ${data.error}`);
      } else {
        setResult(data.result);
      }
    } catch (err: any) {
      setResult(`❌ Erro ao gerar com a IA: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!result) return;
    const encodedText = encodeURIComponent(result);
    const waUrl = whatsappPhone 
      ? `https://api.whatsapp.com/send?phone=55${whatsappPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="ai-assistant-sec">
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-600">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Assistente IA de Diagnósticos</h2>
            <p className="text-xs text-slate-500">Gere laudos técnicos, estimativa de materiais e notificações de conclusão</p>
          </div>
        </div>
        <span className="text-[10px] font-bold tracking-wider text-indigo-700 bg-indigo-150 px-2.5 py-1 rounded-full uppercase">
          Gemini 3.5 Flash
        </span>
      </div>

      <div className="p-6">
        {/* Navigation Tabs */}
        <div className="flex bg-slate-50 p-1.5 rounded-xl gap-1 mb-6 border border-slate-200/50">
          <button
            onClick={() => { setActiveTab("proposal"); setResult(""); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === "proposal"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-500" />
            Laudo & Diagnóstico
          </button>
          
          <button
            onClick={() => { setActiveTab("materials"); setResult(""); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === "materials"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
            }`}
          >
            <ClipboardList className="w-4 h-4 text-indigo-500" />
            Lista de Materiais & Passos
          </button>
          
          <button
            onClick={() => { setActiveTab("whatsapp"); setResult(""); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === "whatsapp"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            Notificar Conclusão
          </button>
        </div>

        {/* Input Forms */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          {/* Controls Column */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {activeTab === "proposal" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-bold">Qual o sintoma ou defeito relatado? *</label>
                    <input
                      type="text"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 bg-slate-50/50 transition-all font-semibold text-slate-705"
                      placeholder="Ex: Compressor de ar condicionado desarmando"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-bold">Categoria da Especialidade</label>
                    <input
                      type="text"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 bg-slate-50/50 transition-all font-semibold text-slate-705"
                      placeholder="Ex: Climatização, Eletricista"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </div>
                </>
              )}

              {activeTab === "materials" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-bold">Para qual conserto precisa planejar materiais? *</label>
                    <input
                      type="text"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 bg-slate-50/50 transition-all font-semibold text-slate-705"
                      placeholder="Ex: Troca de cabeamento estruturado e montagem de comutador rack"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-bold">Especialidade / Tecnologia</label>
                    <input
                      type="text"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 bg-slate-50/50 transition-all font-semibold text-slate-705"
                      placeholder="Ex: Redes de computadores"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </div>
                </>
              )}

              {activeTab === "whatsapp" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-bold">Preencher a partir de uma Requisição (Opcional)</label>
                    <select
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white transition-all font-semibold text-slate-705 focus:outline-none focus:ring-1 focus:ring-indigo-550"
                      value={selectedOSId}
                      onChange={(e) => handleOSSelect(e.target.value)}
                    >
                      <option value="">-- Selecione uma Requisição --</option>
                      {orders.map(o => {
                        const cli = clients.find(c => c.id === o.clientId);
                        return (
                          <option key={o.id} value={o.id}>
                            {o.id} - {o.title.substring(0, 30)}... ({cli ? cli.name : 'Sem nome'})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-bold">Nome do Requisitante *</label>
                      <input
                        type="text"
                        className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none bg-slate-50/50 font-semibold text-slate-705"
                        placeholder="Ex: Ana Clara"
                        value={whatsappClientName}
                        onChange={(e) => setWhatsappClientName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-bold">Telefone (Opcional)</label>
                      <input
                        type="text"
                        className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none bg-slate-50/50 font-semibold text-slate-705"
                        placeholder="Apenas DDD e número"
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-bold">Objeto / Serviço *</label>
                    <input
                      type="text"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none bg-slate-50/50 font-semibold text-slate-755"
                      placeholder="Ex: Diagnóstico de Vazamento em Climatizadora"
                      value={whatsappTitle}
                      onChange={(e) => setWhatsappTitle(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <button
              onClick={executeAction}
              disabled={loading}
              className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-4 rounded-xl shadow-lg shadow-slate-950/10 hover:shadow-slate-950/20 active:translate-y-[1px] disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  Conectando Inteligência Artificial...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Gerar com IA Gemini
                </>
              )}
            </button>
          </div>

          {/* Result Column */}
          <div className="md:col-span-7 flex flex-col bg-slate-50 rounded-xl border border-slate-200/50 min-h-[300px]">
            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-slate-200/60 bg-slate-100/50 rounded-t-xl flex justify-between items-center text-slate-600">
              <span className="text-xs font-bold text-slate-600">Laudo Técnico Sugerido:</span>
              {result && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-600 bg-white border border-slate-200/80 px-2.5 py-1 rounded-lg shadow-sm hover:border-indigo-500/30 transition-all font-bold"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar Conteúdo
                      </>
                    )}
                  </button>

                  {activeTab === "whatsapp" && (
                    <button
                      onClick={handleSendWhatsApp}
                      className="flex items-center gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 rounded-lg shadow-sm font-semibold transition-all font-bold"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar Whats
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Display Textarea / Output */}
            <div className="p-4 flex-1 overflow-y-auto max-h-[350px]">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center py-12 text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-xs text-slate-500 font-bold">Analisando especificações e estruturando diagnóstico...</p>
                </div>
              ) : result ? (
                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans font-semibold">
                  {result}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-12 text-slate-400 space-y-2 text-center">
                  <div className="p-3 bg-white border border-slate-200 shadow-sm rounded-xl">
                    <Sparkles className="w-5 h-5 text-indigo-500/60" />
                  </div>
                  <p className="text-xs font-bold text-slate-500 mt-2">Pronto para gerar laudos técnicos e materiais com IA.</p>
                  <p className="text-[10px] text-slate-400 max-w-[280px]">
                    Preencha as informações do defeito ou selecione uma requisição aberta e acione o cérebro artificial.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Client, Almoxarifado, AccessProfile } from "../types";
import { PRODUCTS_SERVICES_PLANS } from "./TrialExpirationModal";
import { DEFAULT_ACCESS_PROFILES } from "./RolePermissionsManager";
import { 
  UserCheck, UserX, Clock, ShieldCheck, Mail, ShoppingBag, Building2, 
  CheckCircle2, X, AlertCircle, FileText, Sparkles, Check, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface AccountApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  pendingClientsList?: Client[];
  onSelectClient?: (client: Client) => void;
  almoxarifados?: Almoxarifado[];
  accessProfiles?: AccessProfile[];
  onApproveClient: (
    clientId: string,
    type: "gestor" | "requisitante" | "gestor_servicos" | "admin" | string,
    warehouseId?: string,
    workLocation?: string,
    approvalOptions?: {
      isTrialRequested?: boolean;
      trialDays?: number;
      enablePurchaseOpportunity?: boolean;
      proposalEmail?: string;
      selectedPlan?: string;
      proposalValue?: number;
    }
  ) => void;
  onRejectClient: (clientId: string) => void;
}

export default function AccountApprovalModal({
  isOpen,
  onClose,
  client,
  pendingClientsList = [],
  onSelectClient,
  almoxarifados = [],
  accessProfiles = DEFAULT_ACCESS_PROFILES,
  onApproveClient,
  onRejectClient
}: AccountApprovalModalProps) {
  const [selectedUserType, setSelectedUserType] = useState<string>("requisitante");
  const [accessMode, setAccessMode] = useState<"trial" | "full">("trial");
  const [trialDays, setTrialDays] = useState<number>(15);
  const [enablePurchaseOpportunity, setEnablePurchaseOpportunity] = useState<boolean>(true);
  const [proposalEmail, setProposalEmail] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("plan-corporativo");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [workLocation, setWorkLocation] = useState<string>("");

  useEffect(() => {
    if (client) {
      setSelectedUserType(client.userType || "requisitante");
      setAccessMode(client.isTrialRequested !== false ? "trial" : "full");
      setTrialDays(client.trialDays || 15);
      setEnablePurchaseOpportunity(client.enablePurchaseOpportunity !== false);
      setProposalEmail(client.proposalEmail || client.email || "");
      setWarehouseId(client.warehouseId || "");
      setWorkLocation(client.workLocation || client.address || "");
      
      const foundPlan = PRODUCTS_SERVICES_PLANS.find(p => p.name === client.selectedPlan);
      if (foundPlan) {
        setSelectedPlanId(foundPlan.id);
      } else {
        setSelectedPlanId("plan-corporativo");
      }
    }
  }, [client]);

  if (!isOpen || !client) return null;

  const currentSelectedPlan = PRODUCTS_SERVICES_PLANS.find(p => p.id === selectedPlanId) || PRODUCTS_SERVICES_PLANS[1];

  const handleApprove = () => {
    onApproveClient(
      client.id,
      selectedUserType,
      warehouseId || undefined,
      workLocation || undefined,
      {
        isTrialRequested: accessMode === "trial",
        trialDays: accessMode === "trial" ? trialDays : 0,
        enablePurchaseOpportunity,
        proposalEmail: proposalEmail || client.email,
        selectedPlan: currentSelectedPlan.name,
        proposalValue: currentSelectedPlan.price
      }
    );
    onClose();
  };

  const handleReject = () => {
    if (confirm(`Tem certeza que deseja recusar e excluir o cadastro de "${client.name}"?`)) {
      onRejectClient(client.id);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl p-6 sm:p-8 space-y-6 text-slate-100 relative text-left my-8"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-800 pb-5 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-2xl">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-400/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                    Aprovação de Conta & Parâmetros de Acesso
                  </span>
                  {pendingClientsList.length > 1 && (
                    <span className="text-xs text-slate-400 font-mono">
                      ({pendingClientsList.length} cadastros pendentes)
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-extrabold text-white mt-0.5">
                  Autorização de Usuário: <span className="text-amber-400">{client.name}</span>
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Selector bar if multiple pending users */}
          {pendingClientsList.length > 1 && onSelectClient && (
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 pl-1">
                Alternar Cadastro:
              </span>
              <div className="flex items-center gap-2">
                {pendingClientsList.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectClient(p)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      p.id === client.id
                        ? "bg-amber-500 text-slate-950 shadow-md font-extrabold"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <span>{p.name}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* User Profile Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 uppercase font-bold text-[10px] block">CPF de Cadastro</span>
              <span className="font-mono font-extrabold text-slate-200 text-sm">{client.document || "Não informado"}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase font-bold text-[10px] block">E-mail Cadastrado</span>
              <span className="font-semibold text-slate-200 truncate block">{client.email || "Não informado"}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase font-bold text-[10px] block">Telefone / Celular</span>
              <span className="font-semibold text-slate-200 block">{client.phone || "Não informado"}</span>
            </div>
          </div>

          {/* FORM SECTIONS */}
          <div className="space-y-6">
            
            {/* 1. Modalidade de Acesso */}
            <div className="space-y-3">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                1. Modalidade de Acesso e Período de Validade
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Mode 1: Trial 15 days */}
                <div
                  onClick={() => setAccessMode("trial")}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 relative ${
                    accessMode === "trial"
                      ? "bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30"
                      : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-300 uppercase flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Período de Degustação (Teste 15 Dias)
                    </span>
                    <input
                      type="radio"
                      name="accessMode"
                      checked={accessMode === "trial"}
                      onChange={() => setAccessMode("trial")}
                      className="w-4 h-4 text-amber-500 border-slate-700 bg-slate-900 cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    O usuário tem {trialDays} dias de acesso experimental gratuito. Após os 15 dias, surge o popup para envio de proposta sob a <strong>Lei nº 14.133/2021</strong>.
                  </p>

                  {accessMode === "trial" && (
                    <div className="pt-2 border-t border-amber-500/30 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] text-amber-200 font-bold uppercase">Duração (Dias):</span>
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={trialDays}
                        onChange={(e) => setTrialDays(parseInt(e.target.value) || 15)}
                        className="w-20 text-xs font-bold bg-slate-900 border border-amber-500/40 rounded-lg px-2 py-1 text-white text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  )}
                </div>

                {/* Mode 2: Full Access */}
                <div
                  onClick={() => setAccessMode("full")}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 relative ${
                    accessMode === "full"
                      ? "bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/30"
                      : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-300 uppercase flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      Acesso Completo Ilimitado (Contratado)
                    </span>
                    <input
                      type="radio"
                      name="accessMode"
                      checked={accessMode === "full"}
                      onChange={() => setAccessMode("full")}
                      className="w-4 h-4 text-indigo-500 border-slate-700 bg-slate-900 cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Liberação definitiva do cadastro para uso pleno e ilimitado de todas as rotinas autorizadas do sistema sem trava de validade.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Permissão de Oportunidade de Compra & Validação de E-mail de Proposta */}
            <div className="space-y-3 bg-slate-950/80 p-4.5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-amber-400" />
                    2. Gerenciar Oportunidade de Compra e E-mail Comercial (Lei 14.133)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Configure se o usuário poderá emitir a Minuta de Edital e receber propostas comerciais em nome do órgão/empresa.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enablePurchaseOpportunity}
                    onChange={(e) => setEnablePurchaseOpportunity(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {enablePurchaseOpportunity && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-amber-300 uppercase tracking-wider">
                      Validar E-mail Destinatário da Proposta Comercial
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={proposalEmail}
                        onChange={(e) => setProposalEmail(e.target.value)}
                        placeholder="Ex: compras@licitacao.gov.br"
                        className="w-full text-xs font-semibold pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-amber-300 uppercase tracking-wider">
                      Pacote Recomendado para Proposta
                    </label>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer"
                    >
                      {PRODUCTS_SERVICES_PLANS.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} — R$ {plan.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Definição do Perfil e Local de Trabalho */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">
                  Perfil de Acesso do Usuário
                </label>
                <select
                  value={selectedUserType}
                  onChange={(e) => setSelectedUserType(e.target.value)}
                  className="w-full text-xs font-extrabold bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer"
                >
                  {accessProfiles.map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">
                  Almoxarifado Vinculado (Opcional)
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer"
                >
                  <option value="">Nenhum (Acesso Geral)</option>
                  {almoxarifados.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">
                  Local / Setor Requisitante
                </label>
                <input
                  type="text"
                  value={workLocation}
                  onChange={(e) => setWorkLocation(e.target.value)}
                  placeholder="Ex: Secretaria de Obras"
                  className="w-full text-xs font-semibold bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
            </div>

          </div>

          {/* Action Footer Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleReject}
              className="w-full sm:w-auto bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 font-bold text-xs uppercase tracking-wider py-3.5 px-5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <UserX className="w-4 h-4" />
              Recusar / Excluir Cadastro
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5 px-5 rounded-xl cursor-pointer transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleApprove}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider py-3.5 px-6 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                Aprovar e Liberar Acesso do Usuário
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

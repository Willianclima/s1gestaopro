import React, { useState } from "react";
import { CurrentUser } from "../types";
import { Sparkles, FileText, CheckCircle2, Mail, ShieldAlert, Building2, ArrowRight, X, Clock, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TrialExpirationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: CurrentUser;
  onSubmitProposal: (email: string, planName: string, planValue: number) => void;
  onViewEditalDraft?: (email: string, planName: string, planValue: number) => void;
}

export const PRODUCTS_SERVICES_PLANS = [
  {
    id: "plan-basico",
    name: "Módulo Gestão de Chamados & OS",
    description: "Atendimento de chamados, alocação técnica, geolocalização e relatórios de execução.",
    price: 890.00,
    period: "mensal",
    features: [
      "Abertura ilimitada de Ordens de Serviço",
      "Controle de equipes técnicas de campo",
      "Validadores de endereço e GPS",
      "Suporte por e-mail e WhatsApp"
    ],
    badge: "Padrão"
  },
  {
    id: "plan-corporativo",
    name: "Módulo Corporativo OS + Almoxarifados & B.I.",
    description: "Gestão completa com controle de peças em almoxarifados, painel BI e inteligência artificial.",
    price: 1850.00,
    period: "mensal",
    features: [
      "Tudo do Módulo Gestão +",
      "Controle de estoque em múltiplos Almoxarifados",
      "Painéis de Business Intelligence (B.I.)",
      "Assistente de I.A. para triagem automática"
    ],
    recommended: true,
    badge: "Mais Recomendado"
  },
  {
    id: "plan-governo",
    name: "Módulo Governo & Órgão Público (Lei 14.133/2021)",
    description: "Licenciamento completo para órgãos públicos com dispensa/inexigibilidade de licitação.",
    price: 3400.00,
    period: "mensal",
    features: [
      "Acesso ilimitado a todos os módulos do sistema",
      "Adequado à Lei nº 14.133/2021 (Dispensa de Licitação)",
      "Minuta de Termo de Referência inclusa",
      "Garantia de SLA de suporte dedicado em 2h"
    ],
    badge: "Conformidade Publica"
  }
];

export default function TrialExpirationModal({
  isOpen,
  onClose,
  currentUser,
  onSubmitProposal,
  onViewEditalDraft
}: TrialExpirationModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>("plan-corporativo");
  const [proposalEmail, setProposalEmail] = useState<string>(currentUser.proposalEmail || currentUser.email || "");
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(true);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string>("");

  if (!isOpen) return null;

  const selectedPlan = PRODUCTS_SERVICES_PLANS.find(p => p.id === selectedPlanId) || PRODUCTS_SERVICES_PLANS[1];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalEmail || !proposalEmail.includes("@")) {
      setEmailError("Por favor, informe um endereço de e-mail válido para o recebimento da proposta.");
      return;
    }
    setEmailError("");
    onSubmitProposal(proposalEmail, selectedPlan.name, selectedPlan.price);
    setIsSubmitted(true);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl p-6 sm:p-8 space-y-6 text-slate-100 relative text-left my-8"
        >
          {/* Close button if user wants to close modal */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-all cursor-pointer"
            title="Fechar aviso"
          >
            <X className="w-5 h-5" />
          </button>

          {!isSubmitted ? (
            <>
              {/* Top Banner Alert */}
              <div className="bg-gradient-to-r from-amber-500/20 via-indigo-500/10 to-amber-500/20 border border-amber-500/40 rounded-2xl p-4 flex items-start gap-3">
                <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shrink-0 font-extrabold shadow-md">
                  <Clock className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-400/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                      DEGUSTAÇÃO TÉRMINO 15 DIAS
                    </span>
                    <span className="text-xs font-bold text-amber-300">Aviso do Sistema</span>
                  </div>
                  <h3 className="text-base font-extrabold text-white mt-1">
                    Seu Período de Teste Gratuito de 15 Dias Encerrou
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-medium">
                    Olá, <strong>{currentUser.name}</strong>. A sua degustação técnica do sistema de Gestão de Serviços foi concluída. Para manter o acesso contínuo às funcionalidades e emitir suas propostas para abertura de edital, selecione o pacote de interesse abaixo.
                  </p>
                </div>
              </div>

              {/* Title Section */}
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  Contratação Direta & Oportunidade de Compra (Lei nº 14.133/2021)
                </h4>
                <p className="text-xs text-slate-400 font-medium">
                  Selecione o produto/serviço desejado para gerar a <strong>Minuta do Termo de Referência</strong> e enviar a proposta formal ao e-mail responsável do setor de compras ou comissão de licitações.
                </p>
              </div>

              {/* Product Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PRODUCTS_SERVICES_PLANS.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`relative rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-indigo-950/60 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/30"
                          : "bg-slate-950/50 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {plan.recommended && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-md">
                          ⚡ {plan.badge}
                        </span>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between pt-1">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                            isSelected ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-800 text-slate-400"
                          }`}>
                            {plan.badge}
                          </span>
                          <input
                            type="radio"
                            name="plan-selection"
                            checked={isSelected}
                            onChange={() => setSelectedPlanId(plan.id)}
                            className="w-4 h-4 text-indigo-600 border-slate-700 focus:ring-indigo-500 bg-slate-900 cursor-pointer"
                          />
                        </div>

                        <h5 className="font-extrabold text-xs text-white leading-snug">
                          {plan.name}
                        </h5>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          {plan.description}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                        <div>
                          <span className="text-lg font-black text-white">
                            R$ {plan.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400">/{plan.period}</span>
                        </div>

                        <ul className="space-y-1 text-[10px] text-slate-300">
                          {plan.features.slice(0, 3).map((feat, idx) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="truncate">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Email Input & Confirmation Form */}
              <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-800">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-amber-400" />
                      E-mail que vai receber a Proposta de Serviço / Edital
                    </span>
                    <span className="text-[10px] text-indigo-400 font-normal">
                      Obrigatório para envio de Termo de Referência
                    </span>
                  </label>
                  <input
                    type="email"
                    required
                    value={proposalEmail}
                    onChange={(e) => setProposalEmail(e.target.value)}
                    placeholder="Ex: compras@aracatuba.sp.gov.br ou setor.licitacao@empresa.com"
                    className="w-full text-sm font-semibold border border-slate-700 rounded-xl px-4 py-3 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                  {emailError && (
                    <p className="text-xs text-rose-400 font-semibold">{emailError}</p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    Sua proposta comercial com espelho da Lei nº 14.133/2021 será enviada diretamente a este e-mail para que o órgão/empresa possa autuar o processo de dispensa de licitação.
                  </p>
                </div>

                <div className="flex items-start gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <input
                    id="modal-agreed-terms"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 mt-0.5 cursor-pointer"
                  />
                  <label htmlFor="modal-agreed-terms" className="text-xs text-slate-300 leading-relaxed font-medium cursor-pointer">
                    Autorizo o envio da proposta comercial de contratação e declaro estar ciente dos termos de habilitação técnica sob a <strong>Lei nº 14.133/2021 (Lei de Licitações e Contratos Administrativos)</strong>.
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onViewEditalDraft) {
                        onViewEditalDraft(proposalEmail, selectedPlan.name, selectedPlan.price);
                      }
                    }}
                    className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider py-3.5 px-5 rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Visualizar Minuta do Edital
                  </button>

                  <button
                    type="submit"
                    disabled={!agreedToTerms}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Enviar Proposta para o E-mail ({selectedPlan.name.split(" ")[0]})
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* Confirmation State */
            <div className="py-8 text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase px-3 py-1 rounded-full">
                  Proposta Enviada com Sucesso
                </span>
                <h3 className="text-xl font-extrabold text-white">
                  Proposta Comercial Disparada para o E-mail
                </h3>
                <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                  A proposta técnica e comercial do <strong className="text-white">{selectedPlan.name}</strong> foi transmitida com sucesso para o endereço:
                </p>
                <div className="inline-block bg-slate-950 px-4 py-2 rounded-xl border border-indigo-500/30 text-indigo-300 font-mono font-bold text-sm">
                  {proposalEmail}
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left space-y-2 max-w-lg mx-auto text-xs text-slate-300">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <ShieldAlert className="w-4 h-4" />
                  Próximos Passos para Aquisição sob a Lei 14.133/2021:
                </div>
                <ol className="list-decimal pl-5 space-y-1 text-slate-400">
                  <li>Abra a caixa de entrada do e-mail cadastrado e baixe o arquivo em anexo.</li>
                  <li>Incorpore o Termo de Referência ao processo administrativo de Dispensa de Licitação.</li>
                  <li>O Administrador do sistema já recebeu uma notificação interna para liberar a autorização ilimitada assim que emitida a Ordem de Fornecimento/Empenho.</li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onViewEditalDraft) {
                      onViewEditalDraft(proposalEmail, selectedPlan.name, selectedPlan.price);
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <FileText className="w-4 h-4" />
                  Abrir Minuta do Edital no Navegador
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5 px-6 rounded-xl border border-slate-700 cursor-pointer transition-all"
                >
                  Fechar Janela
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

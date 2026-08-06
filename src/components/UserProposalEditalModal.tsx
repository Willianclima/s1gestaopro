import React, { useState } from "react";
import { X, Printer, Copy, Check, FileText, Building2, ShieldCheck, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from "./ToastContext";

interface UserProposalEditalModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  document: string;
  proposalEmail: string;
  planName?: string;
  planValue?: number;
}

export default function UserProposalEditalModal({
  isOpen,
  onClose,
  clientName,
  document,
  proposalEmail,
  planName = "Módulo Corporativo OS + Almoxarifados & B.I.",
  planValue = 1850.00
}: UserProposalEditalModalProps) {
  const { success: toastSuccess } = useToast();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const todayDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  const generateEditalText = () => {
    return `MINUTA DE TERMO DE REFERÊNCIA E PROPOSTA COMERCIAL
DISPENSA DE LICITAÇÃO - LEI Nº 14.133/2021 (ART. 75, INCISO II)

1. IDENTIFICAÇÃO DO SOLICITANTE / ÓRGÃO REQUISITANTE
Razão Social / Nome: ${clientName || "Órgão Contratante / Cliente"}
CPF / CNPJ: ${document || "Não informado"}
E-mail Cadastrado para Recebimento da Proposta: ${proposalEmail || "compras@licitacao.gov.br"}
Data da Solicitação: ${todayDate}

2. DO OBJETO DA CONTRATAÇÃO
Contratação de empresa especializada em tecnologia para prestação de serviços de disponibilização de licença de uso de Software como Serviço (SaaS) referente à plataforma "${planName}", contemplando inteligência de alocação de equipes de campo, gestão de ordens de serviço, controle de insumos em almoxarifados, geolocalização por GPS e painéis de Business Intelligence (B.I.).

3. DA FUNDAMENTAÇÃO LEGAL
A presente contratação fundamenta-se no Artigo 75, Inciso II da Lei Federal nº 14.133, de 1º de abril de 2021 (Lei de Licitações e Contratos Administrativos), por se tratar de contratação de serviços cujo valor anual total enquadra-se dentro do limite legal fixado para dispensa de licitação em razão do valor.

4. DAS ESPECIFICAÇÕES TÉCNICAS E MÓDULOS INCLUSOS
a) Módulo de Gestão de Ordens de Serviço (OS) com triagem e SLA automatizados;
b) Módulo de Almoxarifado Central e depósitos secundários;
c) Módulo de Registro de Atendimento Técnico de Campo via GPS e validação de endereço por CEP/Coordenadas;
d) Painel de Business Intelligence (B.I.) e relatórios analíticos de desempenho;
e) Conformidade total com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).

5. DO VALOR E CONDIÇÕES DE PAGAMENTO
Valor Mensal da Contratação: R$ ${planValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
Valor Anual Estimado: R$ ${(planValue * 12).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
Condição de Pagamento: Emissão de Nota Fiscal de Serviços com vencimento em até 30 (trinta) dias após a atestação dos serviços prestados.

6. DO PRAZO DE VIGÊNCIA
O contrato ou termo de adesão terá vigência inicial de 12 (doze) meses, contados a partir da emissão da Ordem de Serviço ou Empenho, podendo ser prorrogado na forma da lei.

Araçatuba - SP, ${todayDate}.

_____________________________________________________
EQUIPE DE GESTÃO DE SERVIÇOS & LICITAÇÕES INTEGRADAS
Plataforma Homologada | Lei nº 14.133/2021`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateEditalText());
    setCopied(true);
    toastSuccess("Minuta do Edital/Termo de Referência copiada para a área de transferência!", "Texto Copiado");
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white text-slate-800 border border-slate-200 rounded-3xl w-full max-w-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative text-left my-8"
        >
          {/* Top Bar Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-2xl">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-indigo-200">
                  LEI Nº 14.133/2021 - DISPENSA DE LICITAÇÃO
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  Minuta do Termo de Referência / Proposta de Compra
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Document Printable Body */}
          <div id="printable-edital-content" className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 font-mono text-xs leading-relaxed text-slate-700 max-h-[55vh] overflow-y-auto shadow-inner select-text">
            <div className="text-center font-bold text-slate-900 pb-2 border-b border-slate-300">
              MINUTA DE TERMO DE REFERÊNCIA & PROPOSTA COMERCIAL<br/>
              DISPENSA DE LICITAÇÃO - LEI FEDERAL Nº 14.133/2021 (ART. 75, II)
            </div>

            <div className="space-y-1">
              <strong className="text-slate-900 uppercase block font-sans text-[11px]">1. DADOS DO SOLICITANTE / ÓRGÃO REQUISITANTE</strong>
              <p>Razão Social / Nome: {clientName || "Órgão Contratante / Requisitante"}</p>
              <p>CPF / CNPJ: {document || "Não cadastrado"}</p>
              <p>E-mail do Destinatário da Proposta: <span className="text-indigo-600 font-bold">{proposalEmail || "Não informado"}</span></p>
              <p>Data de Emissão: {todayDate}</p>
            </div>

            <div className="space-y-1">
              <strong className="text-slate-900 uppercase block font-sans text-[11px]">2. DO OBJETO DA CONTRATAÇÃO</strong>
              <p>
                Disponibilização de licença de uso do software "{planName}", em modelo SaaS (Software as a Service), para gestão centralizada de ordens de serviço, cadastro de almoxarifados, rastreio de equipes técnicas e geração de indicadores de B.I.
              </p>
            </div>

            <div className="space-y-1">
              <strong className="text-slate-900 uppercase block font-sans text-[11px]">3. FUNDAMENTAÇÃO LEGAL</strong>
              <p>
                Enquadramento legal sob o Art. 75, Inciso II da Lei nº 14.133/2021, em virtude do valor contratual anual situar-se dentro da margem legal de dispensa de licitação para contratações de bens e serviços comuns.
              </p>
            </div>

            <div className="space-y-1">
              <strong className="text-slate-900 uppercase block font-sans text-[11px]">4. VALOR E ESTIMATIVA ORÇAMENTÁRIA</strong>
              <p>Valor Mensal do Pacote: R$ {planValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p>Valor Estimado Anual (12 Meses): R$ {(planValue * 12).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>

            <div className="space-y-1">
              <strong className="text-slate-900 uppercase block font-sans text-[11px]">5. GARANTIA E SLA DE ATENDIMENTO</strong>
              <p>Suporte técnico especializado com atendimento garantido e conformidade integral com a LGPD (Lei nº 13.709/2018).</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <div className="text-xs text-slate-500 font-medium">
              Destinatário: <strong className="text-slate-800">{proposalEmail}</strong>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleCopy}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all border border-slate-300"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                {copied ? "Copiado!" : "Copiar Texto"}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider py-3 px-5 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Printer className="w-4 h-4" />
                Imprimir / PDF
              </button>

              <button
                type="button"
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase py-3 px-4 rounded-xl cursor-pointer transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

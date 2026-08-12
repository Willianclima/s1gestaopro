import { jsPDF } from "jspdf";
import { ServiceOrder, Client, Professional } from "../types";

/**
 * Remove acentos e caracteres especiais para compatibilidade perfeita com a fonte padrão do jsPDF
 */
export function asciiOnly(str: string | undefined | null): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, " ");
}

/**
 * Formata datas no padrão pt-BR
 */
function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Nao informado";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return asciiOnly(dateStr);
    return d.toLocaleDateString("pt-BR") + " as " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return asciiOnly(dateStr);
  }
}

function formatDateShort(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return asciiOnly(dateStr);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return asciiOnly(dateStr);
  }
}

/**
 * Tradução amigável de status da OS
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case "aberto": return "ABERTO (Aguardando Atendimento)";
    case "em_progresso": return "EM PROGRESSO (Atendimento em Andamento)";
    case "aguardando": return "AGUARDANDO MATERIAL / PECA";
    case "concluido": return "CONCLUIDO (Servico Encerrado)";
    case "cancelado": return "CANCELADO";
    default: return asciiOnly(status).toUpperCase();
  }
}

/**
 * Tradução amigável de prioridade
 */
function getPriorityLabel(priority?: string): string {
  switch (priority) {
    case "low": return "BAIXA";
    case "medium": return "MEDIA";
    case "high": return "ALTA";
    case "urgent": return "URGENTE / CRITICA";
    default: return "PADRAO";
  }
}

/**
 * Gera um documento PDF oficial e formatado para a Ordem de Serviço
 */
export function generateServiceOrderPDF(
  order: ServiceOrder,
  client?: Client,
  professional?: Professional
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 15;
  const contentWidth = pageWidth - (marginX * 2); // 180mm

  // =========================================================================
  // 1. CABEÇALHO PRINCIPAL E BANNER CORPORATIVO
  // =========================================================================
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 38, "F");

  // Barra de acento colorida
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 36, pageWidth, 2, "F");

  // Nome do Sistema e Subtítulo
  doc.setTextColor(255, 255, 255);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(20);
  doc.text("GESTAO DE SERVICOS", marginX, 16);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("SISTEMA INTEGRADO DE ATENDIMENTO E MANUTENCAO TECNICA", marginX, 22);
  doc.text("COMPROVANTE E FICHA OFICIAL DE REGISTRO DE OS", marginX, 26);

  // Badge da OS ID
  doc.setFillColor(79, 70, 229); // Indigo badge
  doc.roundedRect(142, 8, 53, 16, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.text("ORDEM DE SERVICO", 168.5, 13, { align: "center" });
  doc.setFontSize(11);
  doc.text(`#${asciiOnly(order.id)}`, 168.5, 20, { align: "center" });

  doc.setTextColor(226, 232, 240);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Emissao: ${formatDate(new Date().toISOString())}`, 142, 29);

  let currentY = 46;

  // =========================================================================
  // 2. BARRA DE IDENTIFICAÇÃO DO DOCUMENTO
  // =========================================================================
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(marginX, currentY, contentWidth, 8, "F");
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.rect(marginX, currentY, contentWidth, 8, "S");

  doc.setTextColor(15, 23, 42);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("FICHA DE REGISTRO TECNICO DE ATENDIMENTO E HISTORICO OPERACIONAL", pageWidth / 2, currentY + 5.5, { align: "center" });

  currentY += 13;

  // =========================================================================
  // 3. BLOCO EM 2 COLUNAS: REQUISITANTE & DADOS MESTRES DA OPERAÇÃO
  // =========================================================================
  const colWidth = (contentWidth - 6) / 2; // 87mm cada coluna
  const leftX = marginX;
  const rightX = marginX + colWidth + 6;
  const boxHeight = 44;

  // Coluna Esquerda: Requisitante / Solicitante
  doc.setFillColor(248, 250, 252);
  doc.rect(leftX, currentY, colWidth, boxHeight, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(leftX, currentY, colWidth, boxHeight, "S");

  doc.setFillColor(226, 232, 240);
  doc.rect(leftX, currentY, colWidth, 6, "F");
  doc.setTextColor(51, 65, 85);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.text("SOLICITANTE / REQUISITANTE", leftX + 3, currentY + 4);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8);
  let detailY = currentY + 11;

  const clientName = client?.name || "Desconhecido / Nao Informado";
  doc.setFont("Helvetica", "bold");
  doc.text(`Nome: ${asciiOnly(clientName)}`, leftX + 3, detailY);
  doc.setFont("Helvetica", "normal");
  detailY += 5;

  doc.text(`Documento: ${asciiOnly(client?.document || "N/A")}`, leftX + 3, detailY);
  detailY += 5;

  const userTypeLabel = client?.userType === "gestor" ? "Gestor Operacional" : client?.userType === "gestor_servicos" ? "Gestor de Servicos" : "Requisitante / Cliente";
  doc.text(`Perfil: ${asciiOnly(userTypeLabel)}`, leftX + 3, detailY);
  detailY += 5;

  doc.text(`Telefone: ${asciiOnly(client?.phone || "Nao informado")}`, leftX + 3, detailY);
  detailY += 5;

  doc.text(`E-mail: ${asciiOnly(client?.email || "Nao informado")}`, leftX + 3, detailY);
  detailY += 5;

  const finalLocation = order.location || client?.address || client?.workLocation || "Endereco Padrão da Unidade";
  const locLines = doc.splitTextToSize(`Local: ${asciiOnly(finalLocation)}`, colWidth - 6);
  doc.text(locLines, leftX + 3, detailY);

  // Coluna Direita: Dados Operacionais
  doc.setFillColor(248, 250, 252);
  doc.rect(rightX, currentY, colWidth, boxHeight, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(rightX, currentY, colWidth, boxHeight, "S");

  doc.setFillColor(226, 232, 240);
  doc.rect(rightX, currentY, colWidth, 6, "F");
  doc.setTextColor(51, 65, 85);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PARAMETROS DA ORDEM DE SERVICO", rightX + 3, currentY + 4);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8);
  detailY = currentY + 11;

  doc.text(`Categoria: ${asciiOnly(order.category || "Geral")}`, rightX + 3, detailY);
  detailY += 5;

  // Status
  doc.setFont("Helvetica", "bold");
  doc.text("Status:", rightX + 3, detailY);
  if (order.status === "concluido") {
    doc.setTextColor(16, 185, 129); // Emerald
  } else if (order.status === "em_progresso") {
    doc.setTextColor(37, 99, 235); // Blue
  } else if (order.status === "aguardando") {
    doc.setTextColor(217, 119, 6); // Amber
  } else {
    doc.setTextColor(100, 116, 139); // Slate
  }
  doc.text(`[ ${getStatusLabel(order.status)} ]`, rightX + 16, detailY);

  doc.setTextColor(15, 23, 42);
  doc.setFont("Helvetica", "normal");
  detailY += 5;

  doc.text(`Prioridade: `, rightX + 3, detailY);
  doc.setFont("Helvetica", "bold");
  if (order.priority === "urgent" || order.priority === "high") {
    doc.setTextColor(225, 29, 72); // Red
  } else {
    doc.setTextColor(15, 23, 42);
  }
  doc.text(getPriorityLabel(order.priority), rightX + 20, detailY);

  doc.setTextColor(15, 23, 42);
  doc.setFont("Helvetica", "normal");
  detailY += 5;

  const profName = professional?.name || order.assignedTo || "Pendente de Alocacao";
  doc.text(`Tecnico Responsavel:`, rightX + 3, detailY);
  doc.setFont("Helvetica", "bold");
  doc.setTextColor(79, 70, 229);
  doc.text(asciiOnly(profName), rightX + 35, detailY);

  doc.setTextColor(15, 23, 42);
  doc.setFont("Helvetica", "normal");
  detailY += 5;

  doc.text(`Data Abertura: ${formatDateShort(order.createdAt || order.startDate)}`, rightX + 3, detailY);
  detailY += 5;

  doc.text(`Previsao de Conclusao: ${formatDateShort(order.endDate)}`, rightX + 3, detailY);

  currentY += boxHeight + 6;

  // =========================================================================
  // 4. DETALHES DO ESCOPO DO SERVIÇO & OBSERVAÇÕES
  // =========================================================================
  doc.setFont("Helvetica", "normal");
  const descLines = doc.splitTextToSize(asciiOnly(order.description), contentWidth - 6);
  const notesLines = order.notes ? doc.splitTextToSize(asciiOnly(order.notes), contentWidth - 12) : [];
  const missingMatLines = order.hasMissingMaterial && order.missingMaterialDescription 
    ? doc.splitTextToSize(asciiOnly(order.missingMaterialDescription), contentWidth - 12) 
    : [];

  let scopeBoxHeight = 16 + (descLines.length * 4.2);
  if (notesLines.length > 0) scopeBoxHeight += 12 + (notesLines.length * 4);
  if (missingMatLines.length > 0) scopeBoxHeight += 12 + (missingMatLines.length * 4);

  scopeBoxHeight = Math.max(28, scopeBoxHeight);

  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, currentY, contentWidth, scopeBoxHeight, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(marginX, currentY, contentWidth, scopeBoxHeight, "S");

  doc.setFillColor(226, 232, 240);
  doc.rect(marginX, currentY, contentWidth, 6, "F");
  doc.setTextColor(51, 65, 85);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.text("ESCOPO DE TRABALHO & ESPECIFICAÇÃO DO PROBLEMA", marginX + 3, currentY + 4);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont("Helvetica", "bold");
  doc.text(`Titulo: ${asciiOnly(order.title)}`, marginX + 3, currentY + 11);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  let innerY = currentY + 16;
  doc.text(descLines, marginX + 3, innerY);
  innerY += descLines.length * 4.2;

  // Alerta de Falta de Material se houver
  if (missingMatLines.length > 0) {
    innerY += 2;
    doc.setFillColor(254, 242, 242); // Red background alert
    doc.setDrawColor(254, 202, 202);
    const alertH = 8 + (missingMatLines.length * 4);
    doc.rect(marginX + 3, innerY, contentWidth - 6, alertH, "F");
    doc.rect(marginX + 3, innerY, contentWidth - 6, alertH, "S");

    doc.setTextColor(185, 28, 28);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("PENDENCIA / MATERIAL EM FALTA:", marginX + 6, innerY + 4);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text(missingMatLines, marginX + 6, innerY + 8);

    innerY += alertH + 2;
  }

  // Notas Adicionais se houver
  if (notesLines.length > 0) {
    innerY += 2;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    const notesH = 8 + (notesLines.length * 4);
    doc.rect(marginX + 3, innerY, contentWidth - 6, notesH, "F");
    doc.rect(marginX + 3, innerY, contentWidth - 6, notesH, "S");

    doc.setTextColor(71, 85, 105);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("NOTAS DE CAMPO & OBSERVACOES TECNICAS:", marginX + 6, innerY + 4);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(notesLines, marginX + 6, innerY + 8);
  }

  currentY += scopeBoxHeight + 6;

  // =========================================================================
  // 5. HISTÓRICO DE ALTERAÇÕES E PARECERES TÉCNICOS (TIMELINE)
  // =========================================================================
  if (order.history && order.history.length > 0) {
    // Verificar quebra de página se não houver espaço suficiente
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, currentY, contentWidth, 7, "F");
    doc.setDrawColor(203, 213, 225);
    doc.rect(marginX, currentY, contentWidth, 7, "S");

    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("HISTORICO DE ATUALIZACOES E PARECERES TECNICOS (TIMELINE)", marginX + 3, currentY + 4.8);

    currentY += 9;

    // Tabela de Histórico
    order.history.forEach((h, index) => {
      const commentLines = doc.splitTextToSize(asciiOnly(h.comment), contentWidth - 12);
      const rowHeight = 10 + (commentLines.length * 4);

      // Nova página se o log ultrapassar o limite
      if (currentY + rowHeight > pageHeight - 35) {
        doc.addPage();
        currentY = 20;
      }

      // Fundo intercalado para facilidade de leitura
      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, currentY, contentWidth, rowHeight, "F");
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX, currentY, contentWidth, rowHeight, "S");

      // Detalhes do Log
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      
      const authorType = h.author === "atendente" ? "Atendente / Gestor" : h.author === "profissional" ? "Tecnico Responsavel" : "Sistema Automático";
      const dateStr = formatDate(h.date);
      doc.text(`[${dateStr}] - ${authorType} | Status: ${getStatusLabel(h.status)}`, marginX + 3, currentY + 4.5);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(commentLines, marginX + 3, currentY + 9);

      currentY += rowHeight + 1.5;
    });

    currentY += 4;
  }

  // =========================================================================
  // 6. EVIDÊNCIAS DE FOTOS / ANEXOS REGISTRADOS
  // =========================================================================
  const totalPhotos = (order.images?.length || 0) + (order.completedImages?.length || 0);
  if (totalPhotos > 0) {
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginX, currentY, contentWidth, 14, "F");
    doc.rect(marginX, currentY, contentWidth, 14, "S");

    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("REGISTRO FOTOGRAFICO E ANEXOS DE CAMPO", marginX + 3, currentY + 4.5);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const photosText = `Esta OS possui ${order.images?.length || 0} foto(s) iniciais de sintoma e ${order.completedImages?.length || 0} foto(s) de encerramento registradas no sistema.`;
    doc.text(photosText, marginX + 3, currentY + 9.5);

    currentY += 18;
  }

  // =========================================================================
  // 7. TERMO DE DECLARAÇÃO & ASSINATURAS OFICIAIS
  // =========================================================================
  if (currentY > pageHeight - 50) {
    doc.addPage();
    currentY = 25;
  }

  // Texto Legal
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const disclaimer = "Declaramos que os serviços e materiais relacionados acima foram executados/verificados em conformidade com as normas operacionais. O aceite formal confirma o recebimento e a validade técnica do atendimento prestado.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth);
  doc.text(disclaimerLines, marginX, currentY);

  currentY += (disclaimerLines.length * 3.5) + 18;

  // Linhas de Assinatura
  const sigLineWidth = 78;
  const leftSigX = marginX;
  const rightSigX = pageWidth - marginX - sigLineWidth;

  doc.setDrawColor(148, 163, 184); // Slate-400
  doc.setLineDashPattern([1.5, 1.5], 0);

  // Assinatura Esquerda (Técnico)
  doc.line(leftSigX, currentY, leftSigX + sigLineWidth, currentY);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const techLabel = professional?.name || order.assignedTo || "Tecnico Responsavel";
  doc.text(asciiOnly(techLabel), leftSigX + (sigLineWidth / 2), currentY + 4, { align: "center" });

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("ASSINATURA DO TECNICO RESPONSAVEL", leftSigX + (sigLineWidth / 2), currentY + 8, { align: "center" });

  // Assinatura Direita (Requisitante / Gestor)
  doc.line(rightSigX, currentY, rightSigX + sigLineWidth, currentY);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const clientLabel = client?.name || "Requisitante / Gestor Solicitante";
  doc.text(asciiOnly(clientLabel), rightSigX + (sigLineWidth / 2), currentY + 4, { align: "center" });

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("ACEITE E AUTORIZACAO DO SOLICITANTE", rightSigX + (sigLineWidth / 2), currentY + 8, { align: "center" });

  doc.setLineDashPattern([], 0); // Reset dash line pattern

  // =========================================================================
  // 8. RODAPÉ E NUMERAÇÃO DE PÁGINAS EM TODAS AS PÁGINAS
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Linha divisória superior do rodapé
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Documento Oficial de Registro de Atendimento Tecnico - Impresso via Gestao de Servicos", marginX, pageHeight - 7);
    doc.text(`Pagina ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 7, { align: "right" });
  }

  return doc;
}

/**
 * Triggers direct browser file download for the service order PDF
 */
export function downloadServiceOrderPDF(
  order: ServiceOrder,
  client?: Client,
  professional?: Professional
): void {
  const doc = generateServiceOrderPDF(order, client, professional);
  const cleanId = order.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Ordem_de_Servico_${cleanId}.pdf`);
}

/**
 * Returns a Blob URL for previewing the PDF document inside an iframe or modal
 */
export function getServiceOrderPDFBlobUrl(
  order: ServiceOrder,
  client?: Client,
  professional?: Professional
): string {
  const doc = generateServiceOrderPDF(order, client, professional);
  const pdfBlob = doc.output("blob");
  return URL.createObjectURL(pdfBlob);
}

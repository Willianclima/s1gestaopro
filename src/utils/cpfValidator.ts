/**
 * Utility module for CPF Document Validation and Municipal Security Analysis
 * Powered by Modulo 11 Checksum and Gemini AI Security Analysis
 */

export interface CpfValidationResult {
  isValid: boolean;
  score: number; // Confidence score from 0 to 100
  verdict: "VALIDO" | "SUSPEITO" | "INVALIDO";
  reason: string;
  regionInfo?: string;
  municipalSecurityFlag: boolean;
  riskFactors?: string[];
  validatedBy: "algorithm" | "gemini_ai" | "hybrid";
}

/**
 * Standard Brazilian Receita Federal Modulo 11 CPF Checksum Algorithm
 */
export function validateCPFAlgorithm(cpfInput: string): { isValid: boolean; reason?: string; regionInfo?: string } {
  if (!cpfInput) {
    return { isValid: false, reason: "CPF não informado." };
  }

  const cleanCPF = cpfInput.replace(/\D/g, "");

  if (cleanCPF.length !== 11) {
    return { isValid: false, reason: `CPF deve possuir exatamente 11 dígitos numéricos (informado: ${cleanCPF.length}).` };
  }

  // Check for repeated sequences (e.g., 00000000000, 11111111111, etc.)
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return { isValid: false, reason: "CPF composto por sequência de números idênticos repetidos." };
  }

  // Validate 1st Verifier Digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i), 10) * (10 - i);
  }
  let rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCPF.charAt(9), 10)) {
    return { isValid: false, reason: "Primeiro dígito verificador do CPF inválido (falha no Módulo 11)." };
  }

  // Validate 2nd Verifier Digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i), 10) * (11 - i);
  }
  rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCPF.charAt(10), 10)) {
    return { isValid: false, reason: "Segundo dígito verificador do CPF inválido (falha no Módulo 11)." };
  }

  // Extract RFB Fiscal Region based on the 9th digit
  const regionDigit = cleanCPF.charAt(8);
  const regionsMap: Record<string, string> = {
    "1": "1ª Região Fiscal (DF, GO, MS, MT, TO)",
    "2": "2ª Região Fiscal (AC, AM, AP, PA, RO, RR)",
    "3": "3ª Região Fiscal (CE, MA, PI)",
    "4": "4ª Região Fiscal (AL, PB, PE, RN)",
    "5": "5ª Região Fiscal (BA, SE)",
    "6": "6ª Região Fiscal (MG)",
    "7": "7ª Região Fiscal (ES, RJ)",
    "8": "8ª Região Fiscal (SP - São Paulo)",
    "9": "9ª Região Fiscal (PR, SC)",
    "0": "10ª Região Fiscal (RS)"
  };

  const regionInfo = regionsMap[regionDigit] || "Região Fiscal Desconhecida";

  return { isValid: true, regionInfo };
}

/**
 * Format raw CPF string into standardized 000.000.000-00 mask
 */
export function formatCPFString(cpfInput: string): string {
  const clean = cpfInput.replace(/\D/g, "").slice(0, 11);
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
}

/**
 * Full-stack CPF Validation utilizing Google Gemini AI for Municipal Veracity Analysis
 */
export async function validateCPFWithGemini(
  cpf: string,
  applicantName?: string,
  authToken?: string
): Promise<CpfValidationResult> {
  const cleanCPF = cpf.replace(/\D/g, "");

  // 1. First perform local algorithmic check
  const algoCheck = validateCPFAlgorithm(cleanCPF);
  if (!algoCheck.isValid) {
    return {
      isValid: false,
      score: 0,
      verdict: "INVALIDO",
      reason: algoCheck.reason || "Dígitos verificadores do CPF inválidos.",
      municipalSecurityFlag: true,
      riskFactors: [algoCheck.reason || "Falha matemática no Módulo 11"],
      validatedBy: "algorithm"
    };
  }

  // 2. Call backend Gemini AI endpoint for advanced veracity & municipal security check
  try {
    const response = await fetch("/api/gemini/validate-cpf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : { "x-app-auth": "self-registration-public" })
      },
      body: JSON.stringify({
        cpf: cleanCPF,
        formattedCpf: formatCPFString(cleanCPF),
        name: applicantName || ""
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.warn("API Gemini de validação de CPF indisponível, usando validação algorítmica:", errData);
      return {
        isValid: true,
        score: 85,
        verdict: "VALIDO",
        reason: `CPF matematicamente válido (${algoCheck.regionInfo}). Validação por algoritmo concluída.`,
        regionInfo: algoCheck.regionInfo,
        municipalSecurityFlag: false,
        validatedBy: "algorithm"
      };
    }

    const data = await response.json();
    return {
      isValid: data.isValid ?? true,
      score: data.score ?? 90,
      verdict: data.verdict || (data.isValid ? "VALIDO" : "INVALIDO"),
      reason: data.reason || "Análise de veracidade concluída.",
      regionInfo: data.regionInfo || algoCheck.regionInfo,
      municipalSecurityFlag: data.municipalSecurityFlag ?? false,
      riskFactors: data.riskFactors || [],
      validatedBy: "hybrid"
    };
  } catch (err) {
    console.warn("Erro de rede ao consultar Gemini AI para CPF, fallback para Módulo 11:", err);
    return {
      isValid: true,
      score: 85,
      verdict: "VALIDO",
      reason: `CPF matematicamente aprovado (${algoCheck.regionInfo}).`,
      regionInfo: algoCheck.regionInfo,
      municipalSecurityFlag: false,
      validatedBy: "algorithm"
    };
  }
}

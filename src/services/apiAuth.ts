/**
 * Gerenciamento e injeção de cabeçalhos de autenticação do cliente para o backend.
 * Utiliza tokens reais de autenticação (Firebase ID Token ou Sessão Assinada do Servidor),
 * sem depender de cabeçalhos inseguros ou papéis adulteráveis no localStorage.
 */

export function getAuthToken(): string | null {
  try {
    if (typeof window !== "undefined") {
      return localStorage.getItem("service_mgt_auth_token") || null;
    }
  } catch (_) {}
  return null;
}

export function setAuthToken(token: string): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem("service_mgt_auth_token", token);
    }
  } catch (_) {}
}

export function clearAuthToken(): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem("service_mgt_auth_token");
    }
  } catch (_) {}
}

/**
 * Retorna os cabeçalhos HTTP com o Bearer token real do usuário ativo.
 */
export function getApiAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

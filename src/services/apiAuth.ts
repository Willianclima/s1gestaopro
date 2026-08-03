/**
 * Retorna os cabeçalhos de autenticação padrão para chamadas à API do backend
 */
export function getApiAuthHeaders(): Record<string, string> {
  let authToken = "Bearer app-session-active";
  try {
    const savedUser = localStorage.getItem("service_mgt_logged_user");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if (user && (user.id || user.userType)) {
        authToken = `Bearer ${user.id}:${user.userType}:${user.document || "auth"}`;
      }
    }
  } catch (_) {}

  return {
    "Content-Type": "application/json",
    "Authorization": authToken,
    "X-App-Auth": "true"
  };
}

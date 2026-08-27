/**
 * Utilitário de Sincronização Stale-While-Revalidate para LocalStorage e Service Worker
 */

export interface SWLocalStorageDataMap {
  [key: string]: string | null | undefined;
}

export function syncLocalStorageWithSW(storageData: SWLocalStorageDataMap) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!navigator.serviceWorker.controller) return;

  try {
    navigator.serviceWorker.controller.postMessage({
      type: "SYNC_LOCALSTORAGE",
      storageData
    });
  } catch (err) {
    console.warn("[SW LocalStorage SWR] Erro ao sincronizar dados com o Service Worker:", err);
  }
}

export function syncAllCoreLocalStorageToSW() {
  if (typeof window === "undefined") return;

  const coreKeys = [
    "service_mgt_orders2",
    "service_mgt_clients2",
    "service_mgt_categories2",
    "service_mgt_professionals2",
    "service_mgt_logs2",
    "service_mgt_logged_user",
    "service_mgt_teams",
    "service_mgt_almoxarifados",
    "service_mgt_smtp",
    "service_mgt_whatsapp",
    "service_mgt_blocked_dates"
  ];

  const payload: SWLocalStorageDataMap = {};
  coreKeys.forEach((key) => {
    const val = localStorage.getItem(key);
    if (val !== null) {
      payload[key] = val;
    }
  });

  syncLocalStorageWithSW(payload);
}

export function requestStaleLocalStorageFromSW(keys: string[]) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!navigator.serviceWorker.controller) return;

  try {
    navigator.serviceWorker.controller.postMessage({
      type: "GET_STALE_LOCALSTORAGE",
      keys
    });
  } catch (err) {
    console.warn("[SW LocalStorage SWR] Erro ao solicitar dados stale do Service Worker:", err);
  }
}

export function initSWLocalStorageSWR(onRevalidated?: (key: string, value: string) => void) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return () => {};

  const handleMessage = (event: MessageEvent) => {
    if (!event.data) return;

    const { type, data, payload, url } = event.data;

    // A. Revalidação individual vinda do handler de rotas de dados (fetch SWR)
    if (type === "LOCALSTORAGE_SWR_UPDATE" && url && payload) {
      try {
        const urlParts = url.split("/");
        const key = urlParts[urlParts.length - 1];
        if (key) {
          const stringified = typeof payload === "string" ? payload : JSON.stringify(payload);
          localStorage.setItem(key, stringified);
          if (onRevalidated) onRevalidated(key, stringified);
          window.dispatchEvent(new CustomEvent("swr_localstorage_updated", { detail: { key, value: stringified } }));
        }
      } catch (e) {
        console.warn("[SW LocalStorage SWR] Falha ao processar atualização de SWR:", e);
      }
    }

    // B. Dados stale ou revalidados vindos por mensagens diretas
    if ((type === "STALE_LOCALSTORAGE_DATA" || type === "REVALIDATED_LOCALSTORAGE_DATA") && data) {
      Object.keys(data).forEach((key) => {
        const val = data[key];
        if (val !== undefined && val !== null) {
          localStorage.setItem(key, val);
          if (onRevalidated) onRevalidated(key, val);
        }
      });
      window.dispatchEvent(new CustomEvent("swr_localstorage_updated", { detail: { data } }));
    }
  };

  navigator.serviceWorker.addEventListener("message", handleMessage);

  // Assim que ativo ou pronto, sincroniza os dados do LocalStorage atual com o Service Worker
  if (navigator.serviceWorker.controller) {
    syncAllCoreLocalStorageToSW();
  }

  return () => {
    navigator.serviceWorker.removeEventListener("message", handleMessage);
  };
}

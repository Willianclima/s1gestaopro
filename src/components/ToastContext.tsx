import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Toast } from "../types";
import ToastContainer from "./Toast";

interface ToastContextType {
  toast: (message: string, type?: "success" | "error" | "info" | "warning", title?: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  warn: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((
    message: string, 
    type: "success" | "error" | "info" | "warning" = "info", 
    title?: string, 
    duration?: number
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, title, duration }]);
  }, []);

  const success = useCallback((message: string, title?: string, duration?: number) => {
    toast(message, "success", title || "Ação Concluída", duration);
  }, [toast]);

  const error = useCallback((message: string, title?: string, duration?: number) => {
    toast(message, "error", title || "Falha Operacional", duration);
  }, [toast]);

  const warn = useCallback((message: string, title?: string, duration?: number) => {
    toast(message, "warning", title || "Atenção", duration);
  }, [toast]);

  const info = useCallback((message: string, title?: string, duration?: number) => {
    toast(message, "info", title || "Atualização", duration);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warn, info }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast deve ser usado dentro de um ToastProvider");
  }
  return context;
}

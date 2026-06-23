import React, { useEffect } from "react";
import { Toast } from "../types";
import { CheckCircle, AlertTriangle, AlertCircle, Info, X, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ToastItemProps {
  toast: Toast;
  onClose: (id: string) => void;
  key?: string;
}

export function ToastItem({ toast, onClose }: ToastItemProps) {
  const { id, message, type, title, duration = 4000 } = toast;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const styles = {
    success: {
      bg: "bg-emerald-55/95 bg-emerald-50 border-emerald-200 text-emerald-900",
      icon: <CheckCircle className="w-5 h-5 text-emerald-600 animate-bounce" />,
      accent: "bg-emerald-500",
      titleColor: "text-emerald-950",
      textColor: "text-slate-700",
      closeBtn: "text-slate-400 hover:text-slate-600 hover:bg-black/5"
    },
    error: {
      bg: "bg-rose-55/95 bg-rose-50 border-rose-200 text-rose-900",
      icon: <AlertCircle className="w-5 h-5 text-rose-600 animate-pulse" />,
      accent: "bg-rose-500",
      titleColor: "text-rose-950",
      textColor: "text-slate-700",
      closeBtn: "text-slate-400 hover:text-slate-600 hover:bg-black/5"
    },
    critical: {
      bg: "bg-slate-950/95 border-red-500/40 text-red-100 shadow-xl shadow-red-950/50",
      icon: <AlertCircle className="w-5 h-5 text-red-500 animate-[bounce_1.4s_infinite] stroke-[2.5]" />,
      accent: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse",
      titleColor: "text-red-400 font-extrabold uppercase tracking-wide flex items-center gap-1.5",
      textColor: "text-red-200 font-medium",
      closeBtn: "text-red-400 hover:text-red-100 hover:bg-white/10"
    },
    warning: {
      bg: "bg-amber-55/95 bg-amber-50 border-amber-250 text-amber-900",
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      accent: "bg-amber-500",
      titleColor: "text-amber-950",
      textColor: "text-slate-700",
      closeBtn: "text-slate-400 hover:text-slate-600 hover:bg-black/5"
    },
    info: {
      bg: "bg-indigo-55/95 bg-indigo-50 border-indigo-200 text-indigo-900",
      icon: <Info className="w-5 h-5 text-indigo-600" />,
      accent: "bg-indigo-500",
      titleColor: "text-indigo-950",
      textColor: "text-slate-700",
      closeBtn: "text-slate-400 hover:text-slate-600 hover:bg-black/5"
    },
    system: {
      bg: "bg-slate-900/98 border-slate-800 text-slate-300 shadow-lg shadow-slate-950/40 font-mono",
      icon: <Terminal className="w-4.5 h-4.5 text-violet-400 stroke-[2] animate-[pulse_2s_infinite]" />,
      accent: "bg-blue-600",
      titleColor: "text-indigo-400 font-bold uppercase tracking-widest text-[9px] flex items-center gap-1",
      textColor: "text-slate-300 font-medium text-[10px]",
      closeBtn: "text-slate-500 hover:text-slate-300 hover:bg-white/5"
    }
  }[type] || {
    bg: "bg-slate-50 border-slate-200 text-slate-900",
    icon: <Info className="w-5 h-5 text-slate-600" />,
    accent: "bg-slate-500",
    titleColor: "text-slate-950",
    textColor: "text-slate-700",
    closeBtn: "text-slate-400 hover:text-slate-600 hover:bg-black/5"
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
      className={`flex items-start gap-4 p-4.5 rounded-2xl border ${styles.bg} shadow-xl max-w-sm w-full pointer-events-auto relative overflow-hidden text-left`}
    >
      {/* Visual Accent Slider Bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${styles.accent}`} />
      
      {/* Icon Indicator */}
      <div className="shrink-0 mt-0.5">
        {styles.icon}
      </div>

      {/* Text Context */}
      <div className="flex-1 space-y-1 block pr-4 ml-1">
        {title && (
          <h4 className={`font-black text-[10px] uppercase tracking-wider ${styles.titleColor}`}>
            {title}
            {type === "critical" && (
              <span className="inline-flex gap-1 items-center shrink-0 ml-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-ping" />
                <span className="text-[8px] bg-red-500/20 text-red-400 px-1 py-0.2 rounded-sm border border-red-500/30">FATAL</span>
              </span>
            )}
          </h4>
        )}
        <p className={`text-[11px] font-bold leading-normal ${styles.textColor}`}>
          {type === "system" && <span className="text-emerald-500 select-none mr-1.5 font-bold">{`>`}</span>}
          {message}
        </p>
      </div>

      {/* Button to Dismiss */}
      <button
        onClick={() => onClose(id)}
        className={`shrink-0 p-1 rounded-lg transition-colors cursor-pointer ${styles.closeBtn}`}
        aria-label="Fechar notificação"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export default function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none p-4 max-h-screen overflow-y-auto">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * =============================================================================
 * Module: frontend/src/components/ui/AppToast.tsx
 * Purpose: Sleek, non-blocking in-app neomorphic toast notification banner
 *          replacing native browser alerts for errors, warnings, and successes.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, framer-motion
 * Public Members: AppToast, ToastNotification, ToastType
 * Side Effects: Auto-dismisses toasts via timer.
 * =============================================================================
 */

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastType = "error" | "warning" | "success" | "info";

export interface ToastNotification {
  id: string;
  type: ToastType;
  message: string;
}

interface AppToastProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const AppToast: React.FC<AppToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastNotification; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const config = {
    error: {
      icon: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
      border: "border-red-500/40",
      text: "text-red-300",
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
      border: "border-amber-500/40",
      text: "text-amber-200",
    },
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
      border: "border-emerald-500/40",
      text: "text-emerald-200",
    },
    info: {
      icon: <Info className="w-5 h-5 text-primary shrink-0" />,
      border: "border-primary/40",
      text: "text-on-surface",
    },
  }[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -15, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-neo-xl neo-card bg-surface-base border ${config.border} shadow-[0_10px_30px_rgba(0,0,0,0.5)]`}
    >
      {config.icon}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${config.text} leading-relaxed`}>{toast.message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="p-1 rounded-neo neo-button text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0 -mr-1 -mt-1"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};

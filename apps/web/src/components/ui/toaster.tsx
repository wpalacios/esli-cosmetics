"use client";

import { AiOutlineClose } from "react-icons/ai";

import { useToast } from "@/hooks/toast/use-toast";
import type { ToastType } from "@esli-cosmetics/types";

function getToastStyles(type: ToastType) {
  const baseStyles =
    "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-xl p-6 pr-8 shadow-lg transition-all hover:shadow-xl";

  const typeStyles: Record<
    ToastType,
    {
      container: string;
      title: string;
      description: string;
      closeButton: string;
    }
  > = {
    success: {
      container: `${baseStyles} border border-success-200 bg-success-50`,
      title: "text-sm font-semibold text-success-800",
      description: "text-sm opacity-90 text-success-700",
      closeButton:
        "text-success-600/50 hover:text-success-800 focus:text-success-800",
    },
    error: {
      container: `${baseStyles} border border-error-200 bg-error-50`,
      title: "text-sm font-semibold text-error-800",
      description: "text-sm opacity-90 text-error-700",
      closeButton:
        "text-error-600/50 hover:text-error-800 focus:text-error-800",
    },
    warning: {
      container: `${baseStyles} border border-warning-200 bg-warning-50`,
      title: "text-sm font-semibold text-warning-800",
      description: "text-sm opacity-90 text-warning-700",
      closeButton:
        "text-warning-600/50 hover:text-warning-800 focus:text-warning-800",
    },
    info: {
      container: `${baseStyles} border border-primary-200 bg-primary-50`,
      title: "text-sm font-semibold text-primary-800",
      description: "text-sm opacity-90 text-primary-700",
      closeButton:
        "text-primary-600/50 hover:text-primary-800 focus:text-primary-800",
    },
  };

  return typeStyles[type];
}

export function Toaster() {
  const { toasts, remove } = useToast();

  return (
    <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {toasts.map(toast => {
        // Fallback to "info" if type is missing or invalid
        const toastType: ToastType = toast.type || "info";
        const styles = getToastStyles(toastType);

        return (
          <div
            key={toast.id}
            className={styles.container}
            style={{
              animationDuration: "150ms",
              animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div className="grid gap-1">
              {toast.title && <div className={styles.title}>{toast.title}</div>}
              {toast.description && (
                <div className={styles.description}>{toast.description}</div>
              )}
            </div>
            <button
              className={`absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 ${styles.closeButton}`}
              onClick={() => remove(toast.id)}
            >
              <AiOutlineClose className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

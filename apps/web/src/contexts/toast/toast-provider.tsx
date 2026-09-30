"use client";

import { createContext, useContext, useReducer } from "react";

import type { Toast } from "@esli-cosmetics/types";

type ToastState = {
  toasts: Toast[];
};

type ToastAction =
  | { type: "ADD_TOAST"; toast: Toast }
  | { type: "UPDATE_TOAST"; toast: Partial<Toast> }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string };

const toastReducer = (state: ToastState, action: ToastAction): ToastState => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts],
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map(t =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      if (toastId) {
        return {
          ...state,
          toasts: state.toasts.filter(t => t.id !== toastId),
        };
      } else {
        return {
          ...state,
          toasts: [],
        };
      }
    }

    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter(t => t.id !== action.toastId),
      };
  }
};

type ToastContextType = {
  toasts: Toast[];
  toast: (props: Omit<Toast, "id">) => string;
  dismiss: (toastId?: string) => void;
  remove: (toastId?: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

type ToastProviderProps = {
  children: React.ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] });

  const toast = ({ ...props }: Omit<Toast, "id">): string => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      id,
      duration: 5000,
      ...props,
    };

    dispatch({
      type: "ADD_TOAST",
      toast: newToast,
    });

    // Auto dismiss after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        dispatch({
          type: "DISMISS_TOAST",
          toastId: id,
        });
      }, newToast.duration);
    }

    return id;
  };

  const dismiss = (toastId?: string) => {
    if (toastId) {
      dispatch({
        type: "DISMISS_TOAST",
        toastId,
      });
    } else {
      dispatch({
        type: "DISMISS_TOAST",
      });
    }
  };

  const remove = (toastId?: string) => {
    if (toastId) {
      dispatch({
        type: "REMOVE_TOAST",
        toastId,
      });
    } else {
      dispatch({
        type: "REMOVE_TOAST",
      });
    }
  };

  return (
    <ToastContext.Provider
      value={{
        toasts: state.toasts,
        toast,
        dismiss,
        remove,
      }}
    >
      {children as any}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

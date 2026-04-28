"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_DURATION = 4000;

function makeId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = makeId();
      setToasts((prev) => [...prev, { id, type, message }]);
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_DURATION);
      timersRef.current.set(id, timer);
    },
    [],
  );

  // Clear any pending timers on unmount to avoid setState-after-unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  // Split toasts into two live regions:
  //  - errors → assertive (interrupt screen reader)
  //  - success/info → polite
  const assertiveToasts = toasts.filter((t) => t.type === "error");
  const politeToasts = toasts.filter((t) => t.type !== "error");

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion
        toasts={politeToasts}
        ariaLive="polite"
        onDismiss={dismiss}
        bottomOffset="bottom-6"
      />
      <ToastRegion
        toasts={assertiveToasts}
        ariaLive="assertive"
        onDismiss={dismiss}
        bottomOffset="bottom-6"
      />
    </ToastContext.Provider>
  );
}

interface ToastRegionProps {
  toasts: Toast[];
  ariaLive: "polite" | "assertive";
  onDismiss: (id: string) => void;
  bottomOffset: string;
}

function ToastRegion({
  toasts,
  ariaLive,
  onDismiss,
  bottomOffset,
}: ToastRegionProps) {
  return (
    <div
      className={`fixed ${bottomOffset} right-6 z-[100] flex flex-col gap-2 pointer-events-none`}
      aria-live={ariaLive}
      aria-atomic="false"
      role={ariaLive === "assertive" ? "alert" : "status"}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto motion-safe:animate-slide-in-right flex items-center gap-3 px-4 py-3 rounded-[10px] border text-[13px] font-medium shadow-lg backdrop-blur-sm max-w-[360px] ${
            t.type === "success"
              ? "bg-recur-success/10 border-recur-success/20 text-recur-success"
              : t.type === "error"
                ? "bg-recur-error/10 border-recur-error/20 text-recur-error"
                : "bg-recur-purple-tint border-recur-border-light text-recur-light"
          }`}
        >
          <ToastIcon type={t.type} />
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="text-current opacity-50 hover:opacity-100 transition-opacity shrink-0 inline-flex items-center justify-center min-w-[24px] min-h-[24px] -m-1 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
            aria-label="Dismiss notification"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

function ToastIcon({ type }: { type: ToastType }) {
  if (type === "success") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
        <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5.5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

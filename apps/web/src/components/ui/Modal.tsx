"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Called when user presses Enter while focused inside the modal (not in textarea). */
  onSubmit?: () => void;
  /** Optional ref to the element that should receive initial focus. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Optional aria-describedby content. */
  description?: string;
}

/**
 * Accessible modal:
 *  - Esc closes
 *  - Backdrop click closes
 *  - Focus moves into the dialog on open and returns to trigger on close
 *  - Body scroll locked while open
 *  - Animated backdrop + content (motion-safe)
 *  - role="dialog" aria-modal labelled by the title
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  onSubmit,
  initialFocusRef,
  description,
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Esc to close + body scroll lock + focus management
  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into dialog
    requestAnimationFrame(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        const focusable = dialogRef.current?.querySelector<HTMLElement>(
          'input, textarea, button, [href], select, [tabindex]:not([tabindex="-1"])',
        );
        focusable?.focus();
      }
    });

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onClose, initialFocusRef]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Enter (without Shift) submits if onSubmit provided and not in a textarea.
      if (
        onSubmit &&
        e.key === "Enter" &&
        !e.shiftKey &&
        e.target instanceof HTMLElement &&
        e.target.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm motion-safe:animate-modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onKeyDown={handleKeyDown}
        className="dark-card-elevated w-full max-w-md mx-4 motion-safe:animate-modal-enter"
      >
        <div className="flex items-start justify-between mb-4 gap-4">
          <h2
            id={titleId}
            className="text-[18px] font-bold text-recur-text-heading"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-recur-text-dim hover:text-recur-text-heading motion-safe:transition-colors p-1 -m-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-primary"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {description && (
          <p
            id={descId}
            className="text-[12px] text-recur-text-muted mb-4 -mt-2"
          >
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

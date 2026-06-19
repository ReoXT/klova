import type { ReactNode } from "react";

export type AlertVariant = "info" | "success" | "warning" | "error";

const config: Record<AlertVariant, { bg: string; border: string; color: string; icon: ReactNode }> = {
  info: {
    bg:     "oklch(0.60 0.15 232 / 0.10)",
    border: "oklch(0.60 0.15 232 / 0.25)",
    color:  "oklch(0.35 0.13 232)",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  success: {
    bg:     "oklch(0.58 0.14 155 / 0.10)",
    border: "oklch(0.58 0.14 155 / 0.28)",
    color:  "oklch(0.35 0.11 155)",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  warning: {
    bg:     "oklch(0.68 0.14 67 / 0.12)",
    border: "oklch(0.68 0.14 67 / 0.30)",
    color:  "oklch(0.42 0.11 67)",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  error: {
    bg:     "oklch(0.57 0.22 25 / 0.09)",
    border: "oklch(0.57 0.22 25 / 0.25)",
    color:  "oklch(0.44 0.19 25)",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

export interface AlertProps {
  variant: AlertVariant;
  /** Optional bold heading rendered above the body text */
  title?: string;
  children: ReactNode;
  /** Provide a handler to show the dismiss button; parent controls visibility */
  onDismiss?: () => void;
  className?: string;
}

export function Alert({ variant, title, children, onDismiss, className = "" }: AlertProps) {
  const { bg, border, color, icon } = config[variant];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${className}`}
      style={{ background: bg, borderColor: border, color }}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>

      <div className="flex-1 text-sm leading-relaxed">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        {children}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity -mt-0.5 -mr-1"
          style={{ color }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

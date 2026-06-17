import type { ReactNode } from "react";
import Link from "next/link";

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
}

export interface EmptyStateProps {
  icon?: ReactNode;
  heading: string;
  message?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon,
  heading,
  message,
  action,
  className = "",
}: EmptyStateProps) {
  const btnClass = `btn btn-${action?.variant ?? "primary"} btn-sm mt-2`;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}
    >
      {icon && (
        <div
          className="text-base-content/20 mb-5 [&>svg]:w-12 [&>svg]:h-12"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      <h3 className="text-xl text-base-content">{heading}</h3>

      {message && (
        <p className="text-sm text-base-content/60 max-w-sm leading-relaxed mt-2">
          {message}
        </p>
      )}

      {action &&
        (action.href ? (
          <Link href={action.href} className={btnClass}>
            {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick} className={btnClass}>
            {action.label}
          </button>
        ))}
    </div>
  );
}

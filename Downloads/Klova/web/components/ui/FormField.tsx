import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode, Ref } from "react";

/* ── Shared error icon ─────────────────────────────────────── */

function ErrorIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

/* ── Shared label + description block ─────────────────────── */

function FieldLabel({
  htmlFor,
  required,
  error,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-sm font-medium ${error ? "text-error" : "text-base-content"}`}
    >
      {children}
      {required && (
        <span className="text-error ml-0.5" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

function FieldHint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-xs text-base-content/50 mt-1">
      {children}
    </p>
  );
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="text-xs text-error flex items-center gap-1.5 mt-1">
      <ErrorIcon />
      {children}
    </p>
  );
}

/* ── FormField — text / email / tel / number / password ───── */

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

export function FormField({
  label,
  hint,
  error,
  required,
  className = "",
  id,
  name,
  ref,
  ...props
}: FormFieldProps) {
  const fieldId  = id ?? (name ? `field-${name}` : `field-${label.toLowerCase().replace(/\s+/g, "-")}`);
  const hintId   = hint  ? `${fieldId}-hint`  : undefined;
  const errorId  = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <FieldLabel htmlFor={fieldId} required={required} error={error}>
        {label}
      </FieldLabel>
      <input
        ref={ref}
        id={fieldId}
        name={name}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        {...props}
        className={[
          "input w-full mt-1.5",
          error ? "input-error" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {hint && !error && <FieldHint id={hintId!}>{hint}</FieldHint>}
      {error && <FieldError id={errorId!}>{error}</FieldError>}
    </div>
  );
}

/* ── SelectField ───────────────────────────────────────────── */

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  ref?: Ref<HTMLSelectElement>;
}

export function SelectField({
  label,
  hint,
  error,
  required,
  className = "",
  id,
  name,
  children,
  ref,
  ...props
}: SelectFieldProps) {
  const fieldId  = id ?? (name ? `field-${name}` : `field-${label.toLowerCase().replace(/\s+/g, "-")}`);
  const hintId   = hint  ? `${fieldId}-hint`  : undefined;
  const errorId  = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <FieldLabel htmlFor={fieldId} required={required} error={error}>
        {label}
      </FieldLabel>
      <select
        ref={ref}
        id={fieldId}
        name={name}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        {...props}
        className={[
          "select w-full mt-1.5",
          error ? "select-error" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </select>
      {hint && !error && <FieldHint id={hintId!}>{hint}</FieldHint>}
      {error && <FieldError id={errorId!}>{error}</FieldError>}
    </div>
  );
}

import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

type Variant = "primary" | "secondary" | "accent" | "neutral" | "ghost" | "outline";
type Size    = "xs" | "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary:   "btn-primary",
  secondary: "btn-secondary",
  accent:    "btn-accent",
  neutral:   "btn-neutral",
  ghost:     "btn-ghost",
  outline:   "btn-primary btn-outline",
};

const sizeClass: Record<Size, string> = {
  xs: "btn-xs",
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  wide?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  wide = false,
  disabled,
  className = "",
  children,
  ref,
  ...props
}: ButtonProps) {
  const classes = [
    "btn",
    variantClass[variant],
    sizeClass[size],
    wide ? "btn-wide" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button ref={ref} {...props} disabled={disabled || loading} className={classes}>
      {loading && (
        <span className="loading loading-spinner loading-sm" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

import type { HTMLAttributes, ReactNode } from "react";

type Shadow = "none" | "xs" | "sm" | "md";

const shadowClass: Record<Shadow, string> = {
  none: "",
  xs:   "shadow-xs",
  sm:   "shadow-sm",
  md:   "shadow-md",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  shadow?: Shadow;
  /** Wraps children in a daisyUI card-body padding block */
  padded?: boolean;
  children: ReactNode;
}

export function Card({
  shadow = "sm",
  padded = false,
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={["card bg-base-100", shadowClass[shadow], className]
        .filter(Boolean)
        .join(" ")}
    >
      {padded ? <div className="card-body">{children}</div> : children}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

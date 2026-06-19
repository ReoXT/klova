export type BookingStatus =
  | "pending_payment"
  | "matched"
  | "paid"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_match";

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; className: string }
> = {
  pending_payment: { label: "Awaiting Payment", className: "badge-warning" },
  matched:         { label: "Matched",          className: "badge-info" },
  paid:            { label: "Paid",             className: "badge-accent" },
  confirmed:       { label: "Confirmed",        className: "badge-success" },
  completed:       { label: "Completed",        className: "badge-neutral" },
  cancelled:       { label: "Cancelled",        className: "badge-error" },
  no_match:        { label: "No Match",         className: "badge-error badge-outline" },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { label, className } = STATUS_CONFIG[status] ?? {
    label: status,
    className: "badge-ghost",
  };
  return (
    <span className={`badge badge-sm badge-soft ${className} whitespace-nowrap`}>
      {label}
    </span>
  );
}

import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminRevenuePage() {
  return (
    <div>
      <PageHeader
        title="Revenue"
        description="Earnings, payouts, and commission breakdown."
      />
      <div
        className="rounded-2xl mt-6"
        style={{
          background: "var(--surface-card)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <EmptyState
          icon={<ChartIcon />}
          heading="No revenue data"
          message="Revenue figures will appear here once confirmed bookings start coming in."
        />
      </div>
    </div>
  );
}

function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>
        {title}
      </h1>
      <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
        {description}
      </p>
    </div>
  );
}

function ChartIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );
}

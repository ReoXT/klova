import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminBookingsPage() {
  return (
    <div>
      <PageHeader
        title="Bookings"
        description="All customer bookings and their current status."
      />
      <div
        className="rounded-2xl mt-6"
        style={{
          background: "var(--surface-card)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <EmptyState
          icon={<ClipboardIcon />}
          heading="No bookings yet"
          message="Bookings will appear here once customers start booking cleaners."
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

function ClipboardIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
    </svg>
  );
}

import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminAvailabilityPage() {
  return (
    <div>
      <PageHeader
        title="Availability"
        description="View and manage cleaner availability slots."
      />
      <div
        className="rounded-2xl mt-6"
        style={{
          background: "var(--surface-card)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <EmptyState
          icon={<CalendarIcon />}
          heading="No availability data"
          message="Cleaner availability will appear here once cleaners are added and slots are seeded."
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

function CalendarIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}

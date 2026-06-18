import Image from "next/image";
import Link from "next/link";

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--surface-page)" }}>
      <header
        className="sticky top-0 z-40 h-14 flex items-center px-4 border-b"
        style={{ background: "var(--surface-page)", borderColor: "var(--border-default)" }}
      >
        <Link href="/" className="flex items-center gap-2" aria-label="Back to Klova home">
          <Image src="/logo.svg" alt="" width={28} height={28} />
          <span className="wordmark text-xl" style={{ color: "var(--klova-primary)" }}>
            Klova
          </span>
        </Link>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

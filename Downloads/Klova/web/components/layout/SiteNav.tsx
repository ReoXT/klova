"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

const ZONES = [
  { name: "Lekki / Ajah",    active: true },
  { name: "Victoria Island", active: false },
  { name: "Ikeja",           active: false },
  { name: "Surulere",        active: false },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* ── Top bar ──────────────────────────────────────────── */}
      <nav
        aria-label="Main navigation"
        className="sticky top-0 z-40 bg-base-100/95 backdrop-blur-sm border-b border-base-300"
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 rounded-sm"
            aria-label="Klova home"
          >
            <Image src="/logo.svg" alt="" width={28} height={28} priority />
            <span className="wordmark text-2xl text-primary">Klova</span>
          </Link>

          {/* Desktop centre — zones dropdown */}
          <div className="hidden lg:flex items-center gap-1">
            <div className="dropdown dropdown-hover">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-ghost btn-sm text-base-content/60 hover:text-base-content gap-1.5"
              >
                Zones we serve
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 rounded-xl shadow-md border border-base-300 w-52 p-2 mt-1.5"
              >
                {ZONES.map((z) => (
                  <li key={z.name}>
                    <span className={`flex items-center gap-3 text-sm py-2 ${!z.active ? "text-base-content/40 cursor-default hover:bg-transparent" : ""}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${z.active ? "bg-success" : "bg-base-300"}`} />
                      {z.name}
                      {!z.active && <span className="text-xs text-base-content/30 ml-auto font-normal">Soon</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Desktop right — CTA */}
          <div className="hidden lg:block">
            <Link href="/book" className="btn btn-primary btn-sm px-5">
              Book a cleaning
            </Link>
          </div>

          {/* Mobile — hamburger */}
          <button
            className="lg:hidden btn btn-ghost btn-square btn-sm"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>

      {/* ── Mobile drawer backdrop ──────────────────────────── */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-50 bg-base-content/25 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setOpen(false)}
      />

      {/* ── Mobile drawer panel ─────────────────────────────── */}
      <div
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] bg-base-100 shadow-xl flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-base-300 shrink-0">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="" width={28} height={28} />
            <span className="wordmark text-2xl text-primary">Klova</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="btn btn-ghost btn-square btn-sm"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto px-5 py-7">
          <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest mb-4">
            Zones we serve
          </p>
          <ul className="space-y-0.5">
            {ZONES.map((z) => (
              <li key={z.name}>
                <span className={`flex items-center gap-3 py-2.5 text-sm ${z.active ? "text-base-content" : "text-base-content/40"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${z.active ? "bg-success" : "bg-base-300"}`} />
                  {z.name}
                  {!z.active && <span className="text-xs text-base-content/30 ml-auto">Coming soon</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Drawer footer */}
        <div className="px-5 pt-4 pb-8 border-t border-base-300 shrink-0">
          <Link
            href="/book"
            className="btn btn-primary w-full"
            onClick={() => setOpen(false)}
          >
            Book a cleaning
          </Link>
        </div>
      </div>
    </>
  );
}

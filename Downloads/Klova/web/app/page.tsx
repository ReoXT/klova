import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8 bg-base-200">
      <div className="text-center space-y-2">
        <h1 className="text-5xl text-primary">Klova</h1>
        <p className="text-base-content/60 text-lg">On-demand home cleaning for Lagos</p>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <button className="btn btn-primary btn-lg">Book a cleaning</button>
        <Link href="/styleguide" className="btn btn-outline btn-lg">
          Design System →
        </Link>
      </div>

      <div className="card bg-base-100 shadow-sm w-80">
        <div className="card-body">
          <div className="flex justify-between items-start">
            <h2 className="card-title">Standard Clean</h2>
            <span className="badge badge-accent">Popular</span>
          </div>
          <p className="text-base-content/70 text-sm">2-bedroom apartment · Lekki / Ajah</p>
          <div className="card-actions justify-between items-center mt-2">
            <span className="font-semibold text-primary">From ₦18,000</span>
            <button className="btn btn-primary btn-sm">Select</button>
          </div>
        </div>
      </div>
    </main>
  );
}

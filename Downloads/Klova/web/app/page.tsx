export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8 bg-base-200">
      <h1 className="text-3xl font-bold">Klova — daisyUI smoke test</h1>

      {/* daisyUI button */}
      <button className="btn btn-primary">Book a cleaning</button>

      {/* daisyUI card */}
      <div className="card bg-base-100 shadow-xl w-80">
        <div className="card-body">
          <h2 className="card-title">Standard Clean</h2>
          <p>2-bedroom apartment · Lekki/Ajah</p>
          <div className="card-actions justify-end">
            <button className="btn btn-primary btn-sm">Select</button>
          </div>
        </div>
      </div>
    </main>
  );
}

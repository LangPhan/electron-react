function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-6 px-6 py-16">
        <span className="w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-300">
          Electron + React + TailwindCSS
        </span>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Project cua ban da san sang
            cho giao dien React.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Renderer hien tai dang chay
            bang React va duoc style voi
            TailwindCSS. Ban co the bat
            dau tao component, route,
            state va UI ngay trong thu
            muc
            <code className="ml-1 rounded bg-white/10 px-2 py-1 text-sm">
              src
            </code>
            .
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <section className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">
              Renderer
            </p>
            <p className="mt-2 text-lg font-medium">
              React 19
            </p>
          </section>
          <section className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">
              Styling
            </p>
            <p className="mt-2 text-lg font-medium">
              TailwindCSS 4
            </p>
          </section>
          <section className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">
              Build
            </p>
            <p className="mt-2 text-lg font-medium">
              Electron Forge + Vite
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

export default App;

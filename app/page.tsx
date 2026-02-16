import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-slate-800 to-black p-4 text-white">
      <div className="relative flex max-w-4xl flex-col items-center text-center">

        {/* Decorative background blur */}
        <div className="absolute -top-40 -z-10 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl filter" />
        <div className="absolute -bottom-40 -z-10 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl filter" />

        <h1 className="mb-4 text-5xl font-extrabold tracking-tight sm:text-7xl">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
            BuscaChozas
          </span>
        </h1>

        <p className="mb-8 max-w-2xl text-lg text-slate-300 sm:text-xl">
          Tu cazador personal de chollos inmobiliarios en Burgos.
          Scraping automático, alertas en tiempo real y análisis de precios históricos.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/login"
            className="rounded-full bg-blue-600 px-8 py-3 text-lg font-semibold transition hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/25"
          >
            Iniciar Sesión
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-slate-600 bg-slate-800/50 px-8 py-3 text-lg font-semibold transition hover:bg-slate-700 hover:border-slate-500 backdrop-blur-sm"
          >
            Ir al Dashboard
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 text-left sm:grid-cols-3">
          <FeatureCard
            title="🔍 Scraping Diario"
            description="Revisión automática de Idealista a las 9:00 y 20:00 h."
            icon="🤖"
          />
          <FeatureCard
            title="🔔 Alertas Reales"
            description="Notificaciones instantáneas en Telegram y Email."
            icon="⚡"
          />
          <FeatureCard
            title="📉 Histórico"
            description="Detecta bajadas de precio y oportunidades únicas."
            icon="📊"
          />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-6 backdrop-blur-sm transition hover:border-slate-600 hover:bg-slate-800/50">
      <div className="mb-2 text-3xl">{icon}</div>
      <h3 className="mb-2 text-xl font-bold text-slate-100">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}

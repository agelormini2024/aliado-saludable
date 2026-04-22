/**
 * DashboardPage — página principal del área autenticada.
 *
 * Muestra:
 * 1. Saludo personalizado con fecha de hoy
 * 2. Tarjetas de métricas: último peso, tendencia vs anterior, meta de peso
 * 3. Gráfico de área con el historial de peso (últimos 30 registros)
 * 4. Resumen semanal: días activos y comidas registradas hoy
 *
 * Cada sección tiene su propio estado de carga (skeleton) y estado vacío,
 * para que las secciones carguen de forma independiente sin bloquear la página.
 *
 * PesoChart se importa con dynamic({ ssr: false }) para evitar que Recharts
 * intente acceder a APIs del DOM durante el render del servidor.
 */
"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { usePesos, useActividad, useResumenCalorias } from "@/hooks/useProgreso";
import { useComidasDelDia } from "@/hooks/useAlimentacion";
import type { ChartDataPoint } from "@/components/dashboard/PesoChart";

/* ─── Carga dinámica del gráfico (sin SSR) ────────────────────────────────── */

const PesoChart = dynamic(
  () =>
    import("@/components/dashboard/PesoChart").then((m) => ({
      default: m.PesoChart,
    })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

/* ─── Helpers de fecha ────────────────────────────────────────────────────── */

function getSaludo(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return "Buenos días";
  if (h >= 12 && h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function getFechaFormateada(): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function getRelativeTime(fechaISO: string): string {
  const diff = Date.now() - new Date(fechaISO).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

function formatFechaChart(fechaISO: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
  }).format(new Date(fechaISO));
}

/** Lunes de la semana actual a las 00:00:00 */
function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = domingo
  const daysToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/* ─── Subcomponentes ──────────────────────────────────────────────────────── */

/** Skeleton pulsante genérico */
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-cream-dark/60 ${className}`} />
  );
}

function ChartSkeleton() {
  return <Skeleton className="h-60 w-full" />;
}

/** Tarjeta de métrica individual */
function MetricCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-6 py-5 ${
        accent
          ? "border-forest/20 bg-forest text-cream"
          : "border-cream-dark bg-white/60"
      }`}
    >
      <p
        className={`mb-3 font-sans text-xs font-semibold uppercase tracking-widest ${
          accent ? "text-forest-light" : "text-ink-muted"
        }`}
      >
        {label}
      </p>
      <div
        className={`mb-1 font-heading italic text-3xl font-semibold leading-none ${
          accent ? "text-cream" : "text-forest"
        }`}
      >
        {value}
      </div>
      {sub && (
        <p
          className={`mt-2 font-sans text-xs ${
            accent ? "text-forest-light" : "text-ink-muted"
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/** Estado vacío para cuando no hay registros de peso */
function EmptyStatePeso() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-forest-pale">
        <span className="text-2xl">📈</span>
      </div>
      <h3 className="mb-2 font-heading italic text-xl text-forest">
        Tu primera entrada te espera
      </h3>
      <p className="mb-6 max-w-xs font-sans text-sm text-ink-muted">
        Registrá tu peso de hoy para ver cómo evoluciona tu proceso semana a
        semana.
      </p>
      <Link
        href="/progreso"
        className="rounded-full bg-forest px-6 py-2.5 font-sans text-sm font-medium text-cream transition-colors hover:bg-forest-mid"
      >
        Registrar mi primer peso
      </Link>
    </div>
  );
}

/**
 * BalanceCard — balance calórico del día en tres columnas: consumidas / quemadas / neto.
 * El color del balance refleja el estado: verde (déficit = bien), ámbar (superávit), gris (cero).
 */
function BalanceCard({
  consumidas,
  quemadas,
  balance,
}: {
  consumidas: number;
  quemadas: number;
  balance: number;
}) {
  const balanceColor =
    balance > 0
      ? "text-amber"
      : balance < 0
        ? "text-forest"
        : "text-ink-muted";

  const balanceBadge =
    balance > 0
      ? "bg-amber-pale text-amber"
      : balance < 0
        ? "bg-forest-pale text-forest"
        : "bg-cream-dark text-ink-muted";

  return (
    <div className="rounded-2xl border border-cream-dark bg-white/60 px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading italic text-lg text-forest">
          Balance de hoy
        </h2>
        <span
          className={`rounded-full px-3 py-1 font-sans text-xs font-semibold ${balanceBadge}`}
        >
          {balance > 0 ? "+" : ""}
          {balance} cal neto
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-cream-dark">
        {/* Consumidas */}
        <div className="pr-4 text-center">
          <p className="mb-1.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Consumidas
          </p>
          <p className="font-heading italic text-2xl font-semibold leading-none text-amber">
            {consumidas}
          </p>
          <p className="mt-0.5 font-sans text-[10px] text-ink-muted">cal</p>
        </div>

        {/* Quemadas */}
        <div className="px-4 text-center">
          <p className="mb-1.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Quemadas
          </p>
          <p className="font-heading italic text-2xl font-semibold leading-none text-forest">
            {quemadas}
          </p>
          <p className="mt-0.5 font-sans text-[10px] text-ink-muted">cal</p>
        </div>

        {/* Balance neto */}
        <div className="pl-4 text-center">
          <p className="mb-1.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Balance
          </p>
          <p
            className={`font-heading italic text-2xl font-semibold leading-none ${balanceColor}`}
          >
            {balance > 0 ? "+" : ""}
            {balance}
          </p>
          <p className="mt-0.5 font-sans text-[10px] text-ink-muted">cal</p>
        </div>
      </div>
    </div>
  );
}

/** Tarjeta del resumen semanal */
function ResumenCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-cream-dark bg-white/60 px-6 py-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-pale text-xl">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="mb-0.5 font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">
          {label}
        </p>
        <p className="font-heading italic text-2xl font-semibold leading-none text-forest">
          {value}
        </p>
        {detail && (
          <p className="mt-1 font-sans text-xs text-ink-muted">{detail}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Página principal ────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const usuario = useAuthStore((s) => s.usuario);

  const { data: pesos, isLoading: loadingPesos } = usePesos(30);
  const { data: actividad, isLoading: loadingActividad } = useActividad(30);
  const { data: comidasHoy, isLoading: loadingComidas } = useComidasDelDia();
  const { data: balance, isLoading: loadingBalance } = useResumenCalorias();

  /* ── Datos derivados del peso ── */
  const ultimoPeso = pesos?.items[0] ?? null;
  const anteriorPeso = pesos?.items[1] ?? null;

  const diferencia = useMemo(() => {
    if (!ultimoPeso || !anteriorPeso) return null;
    return +(ultimoPeso.peso - anteriorPeso.peso).toFixed(1);
  }, [ultimoPeso, anteriorPeso]);

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!pesos?.items.length) return [];
    return [...pesos.items]
      .reverse() // invertir a orden cronológico (más antiguo primero)
      .map((p) => ({
        fechaLabel: formatFechaChart(p.fecha),
        peso: p.peso,
      }));
  }, [pesos]);

  /* ── Días activos esta semana ── */
  const diasActivosEstaSemana = useMemo(() => {
    if (!actividad?.items.length) return 0;
    const startOfWeek = getStartOfWeek();
    const uniqueDays = new Set(
      actividad.items
        .filter((a) => new Date(a.fecha) >= startOfWeek)
        .map((a) => new Date(a.fecha).toDateString()),
    );
    return uniqueDays.size;
  }, [actividad]);

  /* ── Meta y diferencia a la meta ── */
  const meta = usuario?.meta ?? null;
  const faltanParaMeta =
    meta && ultimoPeso ? +(ultimoPeso.peso - meta).toFixed(1) : null;

  return (
    <div className="max-w-5xl space-y-6">
      {/* ── Saludo ── */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1.5 font-sans text-xs font-semibold uppercase tracking-widest text-amber">
            {getFechaFormateada()}
          </p>
          <h1 className="font-heading italic text-4xl font-semibold leading-tight text-forest">
            {getSaludo()},{" "}
            <span className="text-ink">{usuario?.nombre ?? ""}.</span>
          </h1>
        </div>
        <Link
          href="/progreso"
          className="hidden shrink-0 items-center gap-2 rounded-full border border-forest/20 bg-white/60 px-4 py-2 font-sans text-sm font-medium text-forest transition-all hover:bg-forest hover:text-cream sm:flex"
        >
          <span>+</span> Registrar
        </Link>
      </header>

      {/* ── Métricas ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loadingPesos ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            {/* Último peso */}
            <MetricCard
              label="Último peso"
              accent
              value={
                ultimoPeso ? (
                  <>
                    {ultimoPeso.peso}
                    <span className="ml-1 font-sans text-base not-italic text-forest-light">
                      kg
                    </span>
                  </>
                ) : (
                  <span className="text-forest-light">—</span>
                )
              }
              sub={ultimoPeso ? getRelativeTime(ultimoPeso.fecha) : "sin registros"}
            />

            {/* Tendencia */}
            <MetricCard
              label="Tendencia"
              value={
                diferencia !== null ? (
                  <span
                    className={
                      diferencia < 0
                        ? "text-forest-light"
                        : diferencia > 0
                          ? "text-amber"
                          : "text-ink-muted"
                    }
                  >
                    {diferencia > 0 ? "+" : ""}
                    {diferencia} kg
                  </span>
                ) : (
                  <span className="text-ink-muted/50">—</span>
                )
              }
              sub={
                diferencia !== null
                  ? diferencia < 0
                    ? "bajaste desde el registro anterior"
                    : diferencia > 0
                      ? "subiste desde el registro anterior"
                      : "igual al registro anterior"
                  : "necesitás al menos 2 registros"
              }
            />

            {/* Meta */}
            <MetricCard
              label="Tu meta"
              value={
                meta ? (
                  <>
                    {meta}
                    <span className="ml-1 font-sans text-base not-italic text-ink-muted">
                      kg
                    </span>
                  </>
                ) : (
                  <span className="text-ink-muted/50">—</span>
                )
              }
              sub={
                faltanParaMeta !== null && faltanParaMeta > 0
                  ? `faltan ${faltanParaMeta} kg`
                  : faltanParaMeta !== null && faltanParaMeta <= 0
                    ? "¡meta alcanzada! 🎉"
                    : meta
                      ? "seguí registrando tu peso"
                      : "configurá tu meta en Perfil"
              }
            />
          </>
        )}
      </section>

      {/* ── Gráfico de peso ── */}
      <section className="rounded-2xl border border-cream-dark bg-white/60 p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-heading italic text-xl text-forest">
              Tu curva de peso
            </h2>
            <p className="mt-0.5 font-sans text-xs text-ink-muted">
              {pesos?.meta.total
                ? `${pesos.meta.total} ${pesos.meta.total === 1 ? "registro" : "registros"} en total`
                : "últimos 30 registros"}
            </p>
          </div>
          {pesos && pesos.items.length > 1 && (
            <span className="rounded-full bg-forest-pale px-3 py-1 font-sans text-xs font-medium text-forest">
              {pesos.items.length} registros
            </span>
          )}
        </div>

        {loadingPesos ? (
          <ChartSkeleton />
        ) : !pesos?.items.length ? (
          <EmptyStatePeso />
        ) : (
          <>
            <PesoChart data={chartData} />
            {pesos.items.length === 1 && (
              <p className="mt-3 text-center font-sans text-xs text-ink-muted">
                Registrá un segundo peso para ver la tendencia en el gráfico.
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Balance calórico del día ── */}
      <section>
        {loadingBalance ? (
          <Skeleton className="h-32" />
        ) : (
          <BalanceCard
            consumidas={balance?.consumidas ?? 0}
            quemadas={balance?.quemadas ?? 0}
            balance={balance?.balance ?? 0}
          />
        )}
      </section>

      {/* ── Resumen semanal ── */}
      <section>
        <h2 className="mb-3 font-heading italic text-lg text-forest">
          Esta semana
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {loadingActividad ? (
            <Skeleton className="h-24" />
          ) : (
            <ResumenCard
              icon="🏃"
              label="Días activos"
              value={diasActivosEstaSemana}
              detail={
                diasActivosEstaSemana === 0
                  ? "Registrá tu primera actividad"
                  : diasActivosEstaSemana === 1
                    ? "1 día con actividad esta semana"
                    : `${diasActivosEstaSemana} días con actividad esta semana`
              }
            />
          )}

          {loadingComidas ? (
            <Skeleton className="h-24" />
          ) : (
            <ResumenCard
              icon="🥗"
              label="Comidas hoy"
              value={comidasHoy?.length ?? 0}
              detail={
                !comidasHoy?.length
                  ? "No registraste comidas hoy"
                  : comidasHoy.length === 1
                    ? "1 comida registrada hoy"
                    : `${comidasHoy.length} comidas registradas hoy`
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}

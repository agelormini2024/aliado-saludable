/**
 * DetallePacientePage — resumen completo de un paciente para el coach.
 *
 * Muestra:
 * - Cabecera con datos del paciente (nombre, email, meta, altura)
 * - Gráfico de evolución de peso (Recharts, cargado sin SSR)
 * - Medidas corporales (última medición)
 * - Balance calórico de hoy
 * - Actividad reciente (últimas 7)
 * - Comidas de hoy
 *
 * El auth guard lo maneja `(coach)/layout.tsx`.
 * El backend valida que el paciente pertenezca al coach (403 si no).
 */
"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useResumenPaciente } from "@/hooks/useCoach";
import type { PesoPoint } from "./_PesoChartCoach";
import axios from "axios";

/* Importación sin SSR — Recharts usa APIs del DOM */
const PesoChartCoach = dynamic(() => import("./_PesoChartCoach"), { ssr: false });

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/** Fecha relativa en hora local, sin UTC drift. */
function fechaRelativa(fechaISO: string): string {
  const hoy = new Date();
  const hoyMidnight = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const f = new Date(fechaISO);
  const fMidnight = new Date(f.getFullYear(), f.getMonth(), f.getDate());
  const diffDias = Math.round(
    (hoyMidnight.getTime() - fMidnight.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDias === 0) return "hoy";
  if (diffDias === 1) return "ayer";
  return `hace ${diffDias} días`;
}

/** Fecha formateada para el eje X del gráfico: "15 abr". */
function formatFechaEje(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

/** Fecha larga para el tooltip: "15 de abril de 2026". */
function formatFechaCompleta(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Fecha corta para cabeceras de sección: "15 abr. 2026". */
function formatFechaCorta(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const ACTIVIDAD_ICONS: Record<string, string> = {
  CAMINATA: "🚶",
  GYM: "🏋",
  NATACION: "🏊",
  CICLISMO: "🚴",
  OTRO: "⚡",
};

const TIPO_LABELS: Record<string, string> = {
  CAMINATA: "Caminata",
  GYM: "Gym",
  NATACION: "Natación",
  CICLISMO: "Ciclismo",
  OTRO: "Actividad",
};

const MOMENTO_LABELS: Record<string, string> = {
  DESAYUNO: "Desayuno",
  ALMUERZO: "Almuerzo",
  MERIENDA: "Merienda",
  CENA: "Cena",
  SNACK: "Snack",
};

/* ─── Sub-componentes de sección ──────────────────────────────────────────── */

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-cream-dark bg-white p-5 shadow-sm ${className}`}>
      <h2 className="mb-4 font-sans text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ─── Skeleton de carga ───────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="h-4 w-32 rounded-full bg-cream-dark" />
      <div className="rounded-2xl border border-cream-dark bg-white p-6 flex items-center gap-5">
        <div className="h-16 w-16 rounded-full bg-cream-dark shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-48 rounded-full bg-cream-dark" />
          <div className="h-3 w-36 rounded-full bg-cream-dark" />
          <div className="h-3 w-28 rounded-full bg-cream-dark" />
        </div>
      </div>
      <div className="rounded-2xl border border-cream-dark bg-white p-5">
        <div className="h-3 w-24 rounded-full bg-cream-dark mb-4" />
        <div className="h-40 w-full rounded-xl bg-cream-dark" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-cream-dark bg-white p-5 space-y-3">
            <div className="h-3 w-28 rounded-full bg-cream-dark" />
            <div className="h-4 w-20 rounded-full bg-cream-dark" />
            <div className="h-4 w-20 rounded-full bg-cream-dark" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Página principal ────────────────────────────────────────────────────── */

export default function DetallePacientePage() {
  const params = useParams();
  const pacienteId = typeof params.id === "string" ? params.id : "";

  const { data, isLoading, isError, error, refetch } = useResumenPaciente(pacienteId);

  /* ── Loading ── */
  if (isLoading) return (
    <div className="max-w-4xl mx-auto">
      <Skeleton />
    </div>
  );

  /* ── Error 403/404 ── */
  const httpStatus = axios.isAxiosError(error) ? error.response?.status : null;
  if (isError && (httpStatus === 403 || httpStatus === 404)) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Link
          href="/coach/pacientes"
          className="inline-flex items-center gap-1.5 font-sans text-sm text-ink-muted transition-colors hover:text-forest"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Volver a mis pacientes
        </Link>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 py-16 text-center">
          <p className="font-sans font-medium text-red-700">
            Paciente no encontrado o no autorizado
          </p>
          <p className="font-sans text-sm text-red-500">
            Este paciente no existe o no está asignado a tu perfil
          </p>
        </div>
      </div>
    );
  }

  /* ── Error genérico ── */
  if (isError) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Link
          href="/coach/pacientes"
          className="inline-flex items-center gap-1.5 font-sans text-sm text-ink-muted transition-colors hover:text-forest"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Volver a mis pacientes
        </Link>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-100 bg-red-50 py-16 text-center">
          <p className="font-sans font-medium text-red-700">No se pudo cargar el resumen</p>
          <button
            onClick={() => refetch()}
            className="rounded-xl bg-red-600 px-5 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { usuario, ultimosPesos, ultimasMedidas, actividadReciente, comidasHoy, balanceHoy } = data;

  /* Preparar datos del gráfico: invertir para orden cronológico */
  const chartData: PesoPoint[] = [...ultimosPesos].reverse().map((r) => ({
    fechaLabel: formatFechaEje(r.fecha),
    fechaCompleta: formatFechaCompleta(r.fecha),
    peso: r.peso,
  }));

  const inicial = usuario.nombre[0]?.toUpperCase() ?? "?";

  /* Medidas con valor para no mostrar las null */
  const medidasConValor = ultimasMedidas
    ? ([
        { label: "Cintura", value: ultimasMedidas.cintura, unit: "cm" },
        { label: "Cadera", value: ultimasMedidas.cadera, unit: "cm" },
        { label: "Pecho", value: ultimasMedidas.pecho, unit: "cm" },
        { label: "Brazo", value: ultimasMedidas.brazo, unit: "cm" },
        { label: "Muslo", value: ultimasMedidas.muslo, unit: "cm" },
      ] as const).filter((m) => m.value !== null)
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Link de vuelta */}
      <Link
        href="/coach/pacientes"
        className="inline-flex items-center gap-1.5 font-sans text-sm text-ink-muted transition-colors hover:text-forest"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Volver a mis pacientes
      </Link>

      {/* Cabecera del paciente */}
      <div className="flex items-center gap-5 rounded-2xl border border-cream-dark bg-white p-6 shadow-sm">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-forest-pale"
          aria-hidden="true"
        >
          <span className="font-heading italic text-2xl font-semibold text-forest">
            {inicial}
          </span>
        </div>
        <div className="min-w-0">
          <h1 className="font-heading italic text-2xl font-semibold text-ink">
            {usuario.nombre} {usuario.apellido}
          </h1>
          <p className="font-sans text-sm text-ink-muted">{usuario.email}</p>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {usuario.meta && (
              <span className="font-sans text-xs text-ink-muted">
                Meta: <span className="font-medium text-forest">{usuario.meta} kg</span>
              </span>
            )}
            {usuario.altura && (
              <span className="font-sans text-xs text-ink-muted">
                Altura: <span className="font-medium text-ink">{usuario.altura} cm</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico de peso */}
      <SectionCard title={`Evolución de peso (últimos ${ultimosPesos.length} registros)`}>
        <PesoChartCoach data={chartData} />
      </SectionCard>

      {/* Medidas + Balance — grid de 2 columnas en desktop */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Medidas corporales */}
        <SectionCard title="Medidas corporales">
          {ultimasMedidas && medidasConValor.length > 0 ? (
            <>
              <p className="mb-3 font-sans text-xs text-ink-muted">
                Última medición: {formatFechaCorta(ultimasMedidas.fecha)}
              </p>
              <div className="space-y-2">
                {medidasConValor.map((m) => (
                  <div key={m.label} className="flex items-center justify-between">
                    <span className="font-sans text-sm text-ink-muted">{m.label}</span>
                    <span className="font-sans text-sm font-semibold text-ink">
                      {m.value} {m.unit}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="font-sans text-sm italic text-ink-muted">
              Sin medidas registradas aún
            </p>
          )}
        </SectionCard>

        {/* Balance calórico de hoy */}
        <SectionCard title="Balance de hoy">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-sans text-sm text-ink-muted">Consumidas</span>
              <span className="font-sans text-sm font-semibold text-ink">
                {balanceHoy.consumidas.toLocaleString("es-AR")} kcal
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-sm text-ink-muted">Quemadas</span>
              <span className="font-sans text-sm font-semibold text-forest">
                {balanceHoy.quemadas.toLocaleString("es-AR")} kcal
              </span>
            </div>
            <div className="border-t border-cream-dark pt-3 flex items-center justify-between">
              <span className="font-sans text-sm font-medium text-ink">Balance</span>
              <span
                className={`font-heading italic text-lg font-semibold ${
                  balanceHoy.balance <= 0 ? "text-forest" : "text-red-500"
                }`}
              >
                {balanceHoy.balance > 0 ? "+" : ""}
                {balanceHoy.balance.toLocaleString("es-AR")} kcal
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Actividad reciente */}
      <SectionCard title="Actividad reciente (últimas 7)">
        {actividadReciente.length > 0 ? (
          <ul className="space-y-2">
            {actividadReciente.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl bg-cream px-4 py-3"
              >
                <span className="text-lg" aria-hidden="true">
                  {ACTIVIDAD_ICONS[a.tipo] ?? "⚡"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-medium text-ink">
                    {TIPO_LABELS[a.tipo] ?? a.tipo}
                    <span className="ml-2 font-normal text-ink-muted">
                      · {a.duracion} min · {a.calorias} kcal
                    </span>
                  </p>
                  {a.nota && (
                    <p className="truncate font-sans text-xs text-ink-muted">{a.nota}</p>
                  )}
                </div>
                <span className="shrink-0 font-sans text-xs text-ink-muted">
                  {fechaRelativa(a.fecha)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-sans text-sm italic text-ink-muted">
            Sin actividad registrada en los últimos días
          </p>
        )}
      </SectionCard>

      {/* Comidas de hoy */}
      <SectionCard title="Comidas de hoy">
        {comidasHoy.length > 0 ? (
          <ul className="space-y-2">
            {comidasHoy.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-xl bg-cream px-4 py-3"
              >
                <div className="min-w-0">
                  <span className="font-sans text-[10px] font-semibold uppercase tracking-wider text-amber">
                    {MOMENTO_LABELS[c.momento] ?? c.momento}
                  </span>
                  <p className="font-sans text-sm text-ink">{c.descripcion}</p>
                </div>
                <span className="shrink-0 font-sans text-sm font-semibold text-ink-muted">
                  {c.calorias} kcal
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-sans text-sm italic text-ink-muted">
            Sin comidas registradas hoy
          </p>
        )}
      </SectionCard>

    </div>
  );
}

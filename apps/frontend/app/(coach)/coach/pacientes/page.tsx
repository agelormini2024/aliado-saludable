/**
 * PacientesPage — lista de pacientes del coach autenticado.
 *
 * Muestra una grilla de tarjetas con:
 * - Nombre completo del paciente + email
 * - Último peso registrado + fecha relativa (hoy / ayer / hace N días)
 * - Badge de actividad reciente (7 días): Activo / Poca actividad / Sin actividad
 * - Botón "Ver detalle" → `/coach/pacientes/[id]`
 *
 * El auth guard lo maneja `(coach)/layout.tsx` — esta página no lo duplica.
 *
 * Estados:
 * - Loading: skeletons animados
 * - Error: mensaje con botón retry
 * - Empty: estado vacío amigable
 * - Data: grilla 1/2/3 columnas según viewport
 */
"use client";

import { useRouter } from "next/navigation";
import { useMisPacientes, type PacienteCoach } from "@/hooks/useCoach";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * Convierte una fecha ISO a texto relativo usando hora local (sin UTC drift).
 * Compara medianoche local vs. medianoche local del registro — igual que todayLocal().
 */
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

/**
 * Configuración del badge de actividad reciente.
 * - 0 registros → rojo (Sin actividad)
 * - 1–2 registros → ámbar (Poca actividad)
 * - 3+ registros → verde/bosque (Activo)
 */
function actividadConfig(count: number): {
  label: string;
  dot: string;
  container: string;
  text: string;
} {
  if (count === 0) {
    return {
      label: "Sin actividad",
      dot: "bg-red-400",
      container: "bg-red-50 border border-red-100",
      text: "text-red-600",
    };
  }
  if (count <= 2) {
    return {
      label: "Poca actividad",
      dot: "bg-amber",
      container: "bg-amber-pale border border-amber/20",
      text: "text-amber",
    };
  }
  return {
    label: "Activo",
    dot: "bg-forest",
    container: "bg-forest-pale border border-forest/15",
    text: "text-forest",
  };
}

/* ─── Subcomponentes ──────────────────────────────────────────────────────── */

/** Tarjeta de un paciente individual */
function PacienteCard({
  paciente,
  index,
}: {
  paciente: PacienteCoach;
  index: number;
}) {
  const router = useRouter();
  const inicial = paciente.nombre[0]?.toUpperCase() ?? "?";
  const badge = actividadConfig(paciente.actividadReciente);

  return (
    <article
      className="flex flex-col rounded-2xl border border-cream-dark bg-white shadow-sm
                 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
                 animate-fade-in"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
    >
      {/* Cabecera: avatar + nombre + email */}
      <div className="flex items-center gap-4 px-5 pt-5 pb-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center
                        rounded-full bg-forest-pale"
          aria-hidden="true"
        >
          <span className="font-heading italic text-lg font-semibold text-forest">
            {inicial}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-sans text-base font-semibold text-ink truncate">
            {paciente.nombre} {paciente.apellido}
          </p>
          <p className="font-sans text-xs text-ink-muted truncate">{paciente.email}</p>
        </div>
      </div>

      <div className="mx-5 border-t border-cream-dark" />

      {/* Cuerpo: peso + actividad */}
      <div className="flex-1 space-y-4 px-5 py-4">
        {/* Último peso */}
        <div>
          <p className="font-sans text-xs font-medium uppercase tracking-wider text-ink-muted mb-1">
            Último peso
          </p>
          {paciente.ultimoPeso ? (
            <div className="flex items-baseline gap-2">
              <span className="font-heading italic text-2xl font-semibold text-forest">
                {paciente.ultimoPeso.peso.toFixed(1)}
              </span>
              <span className="font-sans text-sm text-ink-muted">kg</span>
              <span className="ml-auto font-sans text-xs text-ink-muted">
                {fechaRelativa(paciente.ultimoPeso.fecha)}
              </span>
            </div>
          ) : (
            <p className="font-sans text-sm text-ink-muted italic">Sin registros aún</p>
          )}
        </div>

        {/* Badge actividad reciente */}
        <div>
          <p className="font-sans text-xs font-medium uppercase tracking-wider text-ink-muted mb-2">
            Actividad (7 días)
          </p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1
                        font-sans text-xs font-semibold ${badge.container} ${badge.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
            {paciente.actividadReciente > 0 && (
              <>{paciente.actividadReciente} &nbsp;</>
            )}
            {badge.label}
          </span>
        </div>
      </div>

      {/* Footer: botón Ver detalle */}
      <div className="px-5 pb-5">
        <button
          onClick={() => router.push(`/coach/pacientes/${paciente.id}`)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl
                     bg-forest px-4 py-2.5 font-sans text-sm font-medium text-cream
                     transition-all duration-150 hover:bg-forest/90 active:scale-[0.98]"
        >
          Ver detalle
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </article>
  );
}

/** Placeholder animado mientras cargan los datos */
function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-2xl border border-cream-dark bg-white shadow-sm animate-pulse">
      <div className="flex items-center gap-4 px-5 pt-5 pb-4">
        <div className="h-12 w-12 rounded-full bg-cream-dark shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded-full bg-cream-dark" />
          <div className="h-3 w-24 rounded-full bg-cream-dark" />
        </div>
      </div>
      <div className="mx-5 border-t border-cream-dark" />
      <div className="flex-1 space-y-4 px-5 py-4">
        <div className="space-y-2">
          <div className="h-3 w-20 rounded-full bg-cream-dark" />
          <div className="h-7 w-28 rounded-lg bg-cream-dark" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-20 rounded-full bg-cream-dark" />
          <div className="h-6 w-28 rounded-full bg-cream-dark" />
        </div>
      </div>
      <div className="px-5 pb-5">
        <div className="h-10 w-full rounded-xl bg-cream-dark" />
      </div>
    </div>
  );
}

/* ─── Página principal ────────────────────────────────────────────────────── */

export default function PacientesPage() {
  const { data: pacientes, isLoading, isError, refetch } = useMisPacientes();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Encabezado */}
      <header>
        <h1 className="font-heading italic text-3xl font-semibold text-ink leading-tight">
          Mis Pacientes
        </h1>
        {pacientes && (
          <p className="mt-1 font-sans text-sm text-ink-muted">
            {pacientes.length === 0
              ? "Sin pacientes asignados"
              : `${pacientes.length} paciente${pacientes.length !== 1 ? "s" : ""} asignado${pacientes.length !== 1 ? "s" : ""}`}
          </p>
        )}
      </header>

      {/* Estado: cargando */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Estado: error */}
      {isError && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-100 bg-red-50 py-12 text-center">
          <svg
            className="h-10 w-10 text-red-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <div>
            <p className="font-sans font-medium text-red-700">
              No se pudo cargar la lista de pacientes
            </p>
            <p className="mt-1 font-sans text-sm text-red-500">
              Verificá tu conexión e intentá de nuevo
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="rounded-xl bg-red-600 px-5 py-2 font-sans text-sm font-medium text-white
                       transition-colors hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Estado: sin pacientes */}
      {!isLoading && !isError && pacientes?.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-cream-dark bg-white py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-pale">
            <svg
              className="h-8 w-8 text-forest"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
          </div>
          <div>
            <p className="font-sans font-semibold text-ink">
              Todavía no tenés pacientes asignados
            </p>
            <p className="mt-1 font-sans text-sm text-ink-muted">
              Pedile al administrador que te asigne pacientes para empezar
            </p>
          </div>
        </div>
      )}

      {/* Lista de pacientes */}
      {!isLoading && !isError && pacientes && pacientes.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pacientes.map((paciente, i) => (
            <PacienteCard key={paciente.id} paciente={paciente} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

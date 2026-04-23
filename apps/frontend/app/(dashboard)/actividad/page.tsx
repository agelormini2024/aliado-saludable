/**
 * ActividadPage — registro y seguimiento de actividad física.
 *
 * Permite registrar sesiones de ejercicio con tipo, duración,
 * calorías estimadas, fecha y nota opcional.
 *
 * El selector de tipo es un grid de botones interactivos (no un <select>)
 * gestionado con Controller de React Hook Form para mantener la integración
 * con Zod y la experiencia de validación consistente.
 *
 * POST /progreso/actividad invalida queryKey ["actividad"] → el historial
 * se refresca automáticamente sin recargar la página.
 */
"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useActividad } from "@/hooks/useProgreso";
import type { RegistroActividad } from "@/hooks/useProgreso";

/* ─── Tipos de actividad ───────────────────────────────────────────────────── */

/** Tipos válidos — deben coincidir con el enum del backend */
const TIPOS = [
  { value: "CAMINATA", label: "Caminata" },
  { value: "GYM", label: "Gym" },
  { value: "NATACION", label: "Natación" },
  { value: "CICLISMO", label: "Ciclismo" },
  { value: "OTRO", label: "Otro" },
] as const;

type TipoActividad = (typeof TIPOS)[number]["value"];

/**
 * Metadatos de presentación para cada tipo de actividad.
 * Gym toma el color ámbar (mayor intensidad), el resto van en verde bosque.
 */
const TIPO_META: Record<TipoActividad, { label: string; badge: string }> = {
  CAMINATA: { label: "Caminata", badge: "bg-forest-pale text-forest" },
  GYM: { label: "Gym", badge: "bg-amber-pale text-amber" },
  NATACION: { label: "Natación", badge: "bg-forest-pale text-forest" },
  CICLISMO: { label: "Ciclismo", badge: "bg-forest-pale text-forest-mid" },
  OTRO: { label: "Otro", badge: "bg-cream-dark text-ink-muted" },
};

/* ─── Schema de validación ─────────────────────────────────────────────────── */

const actividadSchema = z.object({
  tipo: z.enum(["CAMINATA", "GYM", "NATACION", "CICLISMO", "OTRO"], {
    required_error: "Seleccioná un tipo de actividad",
  }),
  /**
   * Duración en minutos — se redondea con Math.round para aceptar input de
   * decimales del usuario sin fallar la validación.
   */
  duracion: z.preprocess(
    (val) =>
      val === "" || val === undefined ? undefined : Math.round(Number(val)),
    z
      .number({ required_error: "Ingresá la duración" })
      .min(1, "Mínimo 1 minuto")
      .max(600, "Máximo 600 minutos"),
  ),
  calorias: z.preprocess(
    (val) => {
      if (val === "" || val === undefined || val === null) return undefined;
      const n = Math.round(Number(val));
      return isNaN(n) ? undefined : n;
    },
    z
      .number({
        required_error: "Ingresá las calorías estimadas",
        invalid_type_error: "Ingresá un número válido",
      })
      .min(0, "Las calorías no pueden ser negativas"),
  ),
  fecha: z.string().min(1, "Seleccioná una fecha"),
  nota: z.string().max(500, "La nota no puede superar 500 caracteres").optional(),
});

type ActividadFormData = z.infer<typeof actividadSchema>;

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

/** Fecha de hoy en formato "YYYY-MM-DD" según hora local (no UTC) */
function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Formatea fecha ISO a "15 abr" en español argentino */
function formatFecha(fechaISO: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
  }).format(new Date(fechaISO));
}

/** Skeleton pulsante genérico */
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-cream-dark/60 ${className}`} />
  );
}

/* ─── Clase base de input ──────────────────────────────────────────────────── */

const inputBase =
  "w-full rounded-xl border border-cream-dark bg-white/60 px-4 py-3 font-sans text-sm text-ink outline-none transition-all placeholder:text-ink-muted/40 focus:border-forest-mid focus:bg-white focus:shadow-[0_0_0_3px_#1E563118]";

/* ─── Componente de campo ──────────────────────────────────────────────────── */

function Field({
  label,
  unit,
  error,
  children,
}: {
  label: string;
  unit?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">
        {label}
      </label>
      <div className="relative">
        {children}
        {unit && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-sans text-sm text-ink-muted">
            {unit}
          </span>
        )}
      </div>
      {error && (
        <p className="mt-1.5 font-sans text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}

/* ─── Formulario de actividad ──────────────────────────────────────────────── */

/**
 * FormActividad — registra una nueva sesión de ejercicio.
 *
 * El campo "tipo" usa Controller + botones visuales en lugar de un <select>
 * estándar, para una experiencia más cálida y táctil.
 *
 * POST /progreso/actividad → invalida queryKey ["actividad"] al completar.
 */
function FormActividad() {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ActividadFormData>({
    resolver: zodResolver(actividadSchema),
    defaultValues: { fecha: getTodayISO() },
  });

  const mutation = useMutation({
    mutationFn: async (data: ActividadFormData) => {
      await api.post("/progreso/actividad", {
        tipo: data.tipo,
        duracion: data.duracion,
        calorias: data.calorias,
        fecha: data.fecha,
        ...(data.nota?.trim() ? { nota: data.nota.trim() } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actividad"] });
      queryClient.invalidateQueries({ queryKey: ["resumen-calorias"] });
      reset({ fecha: getTodayISO(), nota: "" });
    },
  });

  return (
    <div className="rounded-2xl border border-cream-dark bg-white/60 p-6">
      <h2 className="mb-1 font-heading italic text-xl text-forest">
        Nueva actividad
      </h2>
      <p className="mb-5 font-sans text-xs text-ink-muted">
        Cada sesión cuenta. Tu constancia hace la diferencia.
      </p>

      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="space-y-5"
      >
        {/* ── Selector de tipo ── */}
        <div>
          <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Tipo de actividad
          </p>
          <Controller
            name="tipo"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TIPOS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => field.onChange(value)}
                    className={`rounded-xl border py-3 font-sans text-sm font-medium transition-all duration-150 ${
                      field.value === value
                        ? "border-forest bg-forest text-cream shadow-sm"
                        : "border-cream-dark bg-white/60 text-ink-muted hover:border-forest/40 hover:text-forest"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          />
          {errors.tipo && (
            <p className="mt-1.5 font-sans text-xs text-red-500">
              {errors.tipo.message}
            </p>
          )}
        </div>

        {/* ── Duración ── */}
        <Field label="Duración" unit="min" error={errors.duracion?.message}>
          <input
            type="number"
            step="1"
            placeholder="45"
            className={inputBase}
            {...register("duracion")}
          />
        </Field>

        {/* ── Calorías ── */}
        <Field
          label="Calorías estimadas"
          unit="cal"
          error={errors.calorias?.message}
        >
          <input
            type="number"
            step="1"
            placeholder="—"
            className={inputBase}
            {...register("calorias")}
          />
        </Field>

        {/* ── Fecha ── */}
        <Field label="Fecha" error={errors.fecha?.message}>
          <input type="date" className={inputBase} {...register("fecha")} />
        </Field>

        {/* ── Nota ── */}
        <Field label="Nota (opcional)" error={errors.nota?.message}>
          <textarea
            rows={2}
            placeholder="Cómo te sentiste, dónde fuiste…"
            className={`${inputBase} resize-none`}
            {...register("nota")}
          />
        </Field>

        {mutation.isError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 font-sans text-xs text-red-600">
            Ocurrió un error. Verificá tu conexión e intentá de nuevo.
          </p>
        )}

        {mutation.isSuccess && (
          <p className="rounded-xl bg-forest-pale px-4 py-3 font-sans text-xs text-forest">
            Actividad registrada correctamente.
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-full bg-forest py-3 font-sans text-sm font-medium text-cream transition-all hover:bg-forest-mid disabled:opacity-60"
        >
          {mutation.isPending ? "Guardando…" : "Guardar actividad"}
        </button>
      </form>
    </div>
  );
}

/* ─── Historial de actividades ─────────────────────────────────────────────── */

/**
 * HistorialActividad — muestra las últimas 10 sesiones del usuario.
 *
 * Cada entrada muestra el tipo (badge con color), duración (Fraunces italic),
 * calorías (si las registró) y nota opcional.
 */
function HistorialActividad() {
  const { data, isLoading } = useActividad(10);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-cream-dark bg-white/60 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-forest-pale text-forest">
          {/* Ícono rayo — mismo que en el sidebar */}
          <svg className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <p className="font-heading italic text-lg text-forest">
          Sin actividades todavía
        </p>
        <p className="mt-1 max-w-xs font-sans text-xs text-ink-muted">
          Tu primer registro de ejercicio va a aparecer acá.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cream-dark bg-white/60 p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-heading italic text-lg text-forest">
          Actividades recientes
        </h3>
        <span className="rounded-full bg-cream-dark px-3 py-1 font-sans text-xs text-ink-muted">
          {data.meta.total}{" "}
          {data.meta.total === 1 ? "sesión" : "sesiones"} en total
        </span>
      </div>

      <div className="space-y-3">
        {data.items.map((item: RegistroActividad) => {
          /* Fallback para tipos inesperados que no estén en TIPO_META */
          const meta = TIPO_META[item.tipo as TipoActividad] ?? {
            label: item.tipo,
            badge: "bg-cream-dark text-ink-muted",
          };

          return (
            <div
              key={item.id}
              className="rounded-xl border border-cream-dark/60 bg-cream/40 p-4"
            >
              {/* Cabecera: tipo + fecha */}
              <div className="mb-2 flex items-start justify-between gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 font-sans text-xs font-semibold ${meta.badge}`}
                >
                  {meta.label}
                </span>
                <span className="shrink-0 font-sans text-[11px] text-ink-muted">
                  {formatFecha(item.fecha)}
                </span>
              </div>

              {/* Duración y calorías */}
              <div className="flex items-baseline gap-2.5">
                <p className="font-heading italic text-2xl leading-none text-forest">
                  {item.duracion}
                  <span className="ml-1 font-sans text-sm not-italic text-ink-muted">
                    min
                  </span>
                </p>
                <p className="font-sans text-sm text-ink-muted">
                  · {item.calorias} cal
                </p>
              </div>

              {/* Nota */}
              {item.nota && (
                <p className="mt-1.5 font-sans text-xs italic text-ink-muted">
                  &ldquo;{item.nota}&rdquo;
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Página principal ─────────────────────────────────────────────────────── */

/**
 * ActividadPage — punto de entrada de la sección de actividad física.
 *
 * Layout de dos columnas en desktop (2/5 formulario + 3/5 historial),
 * apiladas en mobile. Consistente con la página de Progreso.
 */
export default function ActividadPage() {
  return (
    <div className="max-w-5xl space-y-6">
      {/* ── Encabezado ── */}
      <header>
        <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-widest text-amber">
          Movimiento y energía
        </p>
        <h1 className="font-heading italic text-4xl font-semibold leading-tight text-forest">
          Actividad física
        </h1>
      </header>

      {/* ── Layout principal ── */}
      <div className="grid animate-fade-in grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <FormActividad />
        </div>
        <div className="lg:col-span-3">
          <HistorialActividad />
        </div>
      </div>
    </div>
  );
}

/**
 * AlimentacionPage — diario de comidas del día.
 *
 * Permite registrar lo que se come a lo largo del día con descripción libre,
 * momento (Desayuno / Almuerzo / Merienda / Cena / Snack) y calorías opcionales.
 *
 * La vista del día agrupa las entradas por momento en orden cronológico.
 * Un navegador de fechas (prev/next) permite revisar días anteriores.
 *
 * La fecha seleccionada es compartida: el formulario registra contra esa fecha
 * y la vista del día muestra los registros de esa fecha.
 *
 * Diferencia clave vs. progreso/actividad:
 * GET /alimentacion/comidas responde { data: RegistroComida[] } — CON wrapper.
 * El hook useComidasDelDia ya lo maneja correctamente.
 */
"use client";

import { useState, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useComidasDelDia } from "@/hooks/useAlimentacion";
import type { RegistroComida } from "@/hooks/useAlimentacion";

/* ─── Momentos del día ─────────────────────────────────────────────────────── */

const MOMENTOS = [
  { value: "DESAYUNO", label: "Desayuno" },
  { value: "ALMUERZO", label: "Almuerzo" },
  { value: "MERIENDA", label: "Merienda" },
  { value: "CENA", label: "Cena" },
  { value: "SNACK", label: "Snack" },
] as const;

type MomentoComida = (typeof MOMENTOS)[number]["value"];

/** Orden en que se muestran los momentos en la vista del día */
const ORDEN_MOMENTOS: MomentoComida[] = [
  "DESAYUNO",
  "ALMUERZO",
  "MERIENDA",
  "CENA",
  "SNACK",
];

/**
 * Metadatos de presentación por momento.
 * Desayuno/Merienda en ámbar (mañana/tarde), Almuerzo/Cena en bosque (comidas principales).
 */
const MOMENTO_META: Record<MomentoComida, { label: string; badge: string }> = {
  DESAYUNO: { label: "Desayuno", badge: "bg-amber-pale text-amber" },
  ALMUERZO: { label: "Almuerzo", badge: "bg-forest-pale text-forest" },
  MERIENDA: { label: "Merienda", badge: "bg-amber-pale text-amber" },
  CENA: { label: "Cena", badge: "bg-forest-pale text-forest-mid" },
  SNACK: { label: "Snack", badge: "bg-cream-dark text-ink-muted" },
};

/* ─── Schema de validación ─────────────────────────────────────────────────── */

const comidaSchema = z.object({
  momento: z.enum(["DESAYUNO", "ALMUERZO", "MERIENDA", "CENA", "SNACK"], {
    required_error: "Seleccioná el momento del día",
  }),
  descripcion: z
    .string()
    .min(1, "Describí lo que comiste")
    .max(500, "La descripción no puede superar 500 caracteres"),
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
});

type ComidaFormData = z.infer<typeof comidaSchema>;

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Formatea "YYYY-MM-DD" a "mar. 22 abr." para el navegador de fechas.
 * Agrega "T12:00:00" para evitar el timezone shift de new Date("YYYY-MM-DD").
 */
function formatFechaCorta(fechaISO: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(fechaISO + "T12:00:00"));
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-cream-dark/60 ${className}`} />
  );
}

/* ─── Estilos base ─────────────────────────────────────────────────────────── */

const inputBase =
  "w-full rounded-xl border border-cream-dark bg-white/60 px-4 py-3 font-sans text-sm text-ink outline-none transition-all placeholder:text-ink-muted/40 focus:border-forest-mid focus:bg-white focus:shadow-[0_0_0_3px_#1E563118]";

/* ─── Campo de formulario ──────────────────────────────────────────────────── */

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

/* ─── Navegador de fechas ──────────────────────────────────────────────────── */

/**
 * DateNavigator — permite moverse entre días (sin ir al futuro).
 * El día actual se muestra como "Hoy"; los demás con formato "mar. 22 abr."
 */
function DateNavigator({
  fecha,
  onChange,
}: {
  fecha: string;
  onChange: (d: string) => void;
}) {
  const isToday = fecha === getTodayISO();

  const moveDay = (dir: -1 | 1) => {
    const d = new Date(fecha + "T12:00:00");
    d.setDate(d.getDate() + dir);
    const next = d.toISOString().split("T")[0];
    if (dir === 1 && next > getTodayISO()) return;
    onChange(next);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => moveDay(-1)}
        aria-label="Día anterior"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-cream-dark bg-white/60 text-ink-muted transition-all hover:border-forest/40 hover:text-forest"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <span className="min-w-28 text-center font-sans text-sm font-medium text-ink-muted">
        {isToday ? "Hoy" : formatFechaCorta(fecha)}
      </span>

      <button
        type="button"
        onClick={() => moveDay(1)}
        disabled={isToday}
        aria-label="Día siguiente"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-cream-dark bg-white/60 text-ink-muted transition-all hover:border-forest/40 hover:text-forest disabled:cursor-not-allowed disabled:opacity-30"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}

/* ─── Formulario de comida ─────────────────────────────────────────────────── */

/**
 * FormComida — registra una nueva ingesta del día.
 *
 * La `selectedDate` viene del estado del padre (AlimentacionPage).
 * No hay campo de fecha en el formulario — se usa la fecha activa del navegador.
 *
 * Al completar: invalida ["comidas"] (todas las fechas en caché) para que
 * la VistaDia refleje el nuevo registro automáticamente.
 *
 * El `momento` se conserva al resetear para facilitar el registro de
 * múltiples ítems del mismo momento (ej: varias cosas en el almuerzo).
 */
function FormComida({ selectedDate }: { selectedDate: string }) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ComidaFormData>({
    resolver: zodResolver(comidaSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: ComidaFormData) => {
      await api.post("/alimentacion/comidas", {
        momento: data.momento,
        descripcion: data.descripcion,
        calorias: data.calorias,
        fecha: selectedDate,
      });
    },
    onSuccess: (_, submitted) => {
      queryClient.invalidateQueries({ queryKey: ["comidas"] });
      queryClient.invalidateQueries({ queryKey: ["resumen-calorias"] });
      reset({ momento: submitted.momento, descripcion: "" });
    },
  });

  return (
    <div className="rounded-2xl border border-cream-dark bg-white/60 p-6">
      <h2 className="mb-1 font-heading italic text-xl text-forest">
        Agregar comida
      </h2>
      <p className="mb-5 font-sans text-xs text-ink-muted">
        Sin reglas ni restricciones — solo anotá lo que comiste.
      </p>

      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="space-y-5"
      >
        {/* ── Selector de momento ── */}
        <div>
          <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Momento del día
          </p>
          <Controller
            name="momento"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-2">
                {MOMENTOS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => field.onChange(value)}
                    className={`rounded-xl border py-2.5 font-sans text-sm font-medium transition-all duration-150 ${
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
          {errors.momento && (
            <p className="mt-1.5 font-sans text-xs text-red-500">
              {errors.momento.message}
            </p>
          )}
        </div>

        {/* ── Descripción ── */}
        <Field label="¿Qué comiste?" error={errors.descripcion?.message}>
          <textarea
            rows={3}
            placeholder="Ensalada con pollo grillado y un vaso de agua…"
            className={`${inputBase} resize-none`}
            {...register("descripcion")}
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

        {mutation.isError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 font-sans text-xs text-red-600">
            Ocurrió un error. Verificá tu conexión e intentá de nuevo.
          </p>
        )}

        {mutation.isSuccess && (
          <p className="rounded-xl bg-forest-pale px-4 py-3 font-sans text-xs text-forest">
            Comida registrada correctamente.
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-full bg-forest py-3 font-sans text-sm font-medium text-cream transition-all hover:bg-forest-mid disabled:opacity-60"
        >
          {mutation.isPending ? "Guardando…" : "Guardar comida"}
        </button>
      </form>
    </div>
  );
}

/* ─── Vista del día ────────────────────────────────────────────────────────── */

/**
 * VistaDia — muestra las comidas registradas para la fecha indicada.
 *
 * Las entradas se agrupan por momento en orden DESAYUNO → ALMUERZO →
 * MERIENDA → CENA → SNACK. Solo se muestran los momentos que tienen
 * al menos un registro (no aparecen secciones vacías).
 *
 * Si hay calorías registradas en al menos una entrada, se muestra
 * el total estimado del día en el encabezado.
 */
function VistaDia({ fecha }: { fecha: string }) {
  const { data: comidas, isLoading } = useComidasDelDia(fecha);

  const totalCal = useMemo(
    () => (comidas ?? []).reduce((sum, c) => sum + c.calorias, 0),
    [comidas],
  );

  const groups = useMemo(() => {
    if (!comidas?.length) return [];
    return ORDEN_MOMENTOS.map((momento) => ({
      momento,
      items: comidas.filter((c) => c.momento === momento),
    })).filter((g) => g.items.length > 0);
  }, [comidas]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (!comidas?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-cream-dark bg-white/60 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-forest-pale text-forest">
          {/* Ícono tenedor/comida — mismo estilo que los iconos del sidebar */}
          <svg className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
            <path d="M3 4a1 1 0 011-1h1v4.586l.293-.293a1 1 0 011.414 1.414L6 10.414V16a1 1 0 11-2 0v-5.586l-.707-.707A1 1 0 014 8.586V4a1 1 0 011-1zM9 3a1 1 0 00-1 1v4a3 3 0 003 3v5a1 1 0 102 0v-5a3 3 0 003-3V4a1 1 0 00-1-1 1 1 0 00-1 1v3h-4V4a1 1 0 00-1-1z" />
          </svg>
        </div>
        <p className="font-heading italic text-lg text-forest">
          Sin comidas registradas
        </p>
        <p className="mt-1 max-w-xs font-sans text-xs text-ink-muted">
          Empezá a anotar lo que comés — sin juzgar, solo registrando.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cream-dark bg-white/60 p-6">
      {/* Encabezado */}
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-heading italic text-lg text-forest">
          Lo que comiste
        </h3>
        {totalCal > 0 && (
          <span className="rounded-full bg-cream-dark px-3 py-1 font-sans text-xs text-ink-muted">
            ~{totalCal} cal en total
          </span>
        )}
      </div>

      {/* Grupos por momento */}
      <div className="space-y-5">
        {groups.map(({ momento, items }) => {
          const meta = MOMENTO_META[momento];
          return (
            <div key={momento}>
              {/* Encabezado del momento: badge + línea divisora */}
              <div className="mb-2.5 flex items-center gap-3">
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 font-sans text-xs font-semibold ${meta.badge}`}
                >
                  {meta.label}
                </span>
                <div className="h-px flex-1 bg-cream-dark" />
              </div>

              {/* Entradas del momento */}
              <div className="space-y-2">
                {items.map((item: RegistroComida) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-cream-dark/60 bg-cream/40 px-4 py-3"
                  >
                    <p className="flex-1 font-sans text-sm leading-snug text-ink">
                      {item.descripcion}
                    </p>
                    <span className="shrink-0 font-sans text-xs text-ink-muted">
                      {item.calorias} cal
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Página principal ─────────────────────────────────────────────────────── */

/**
 * AlimentacionPage — punto de entrada del diario de alimentación.
 *
 * Mantiene `selectedDate` como estado compartido entre el formulario y la vista:
 * - FormComida registra contra esa fecha
 * - VistaDia muestra los registros de esa fecha
 * - DateNavigator permite navegar a días anteriores (no al futuro)
 *
 * Layout: formulario 2/5 (izq) + vista del día 3/5 (der) en desktop,
 * apilados en mobile. Consistente con Progreso y Actividad.
 */
export default function AlimentacionPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayISO());

  return (
    <div className="max-w-5xl space-y-6">
      {/* ── Encabezado con navegador de fechas ── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-widest text-amber">
            Tu diario de comidas
          </p>
          <h1 className="font-heading italic text-4xl font-semibold leading-tight text-forest">
            Alimentación
          </h1>
        </div>
        <DateNavigator fecha={selectedDate} onChange={setSelectedDate} />
      </header>

      {/* ── Layout principal ── */}
      <div className="grid animate-fade-in grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <FormComida selectedDate={selectedDate} />
        </div>
        <div className="lg:col-span-3">
          <VistaDia fecha={selectedDate} />
        </div>
      </div>
    </div>
  );
}

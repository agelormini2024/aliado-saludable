/**
 * ProgresoPage — registro y seguimiento de peso y medidas corporales.
 *
 * Organizada en dos tabs:
 * - "Peso": formulario de registro + historial de los últimos 10 pesos
 * - "Medidas": formulario de registro + historial de las últimas 5 sesiones de medidas
 *
 * Cada formulario usa React Hook Form + Zod para validación del lado cliente.
 * Los POST invalidan la query cache de Tanstack Query para refrescar el historial
 * automáticamente sin recargar la página.
 *
 * Diseño: layout de dos columnas en desktop (formulario + historial en paralelo).
 * El historial de pesos usa un timeline vertical con dots codificados por color.
 */
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePesos, useMedidas } from "@/hooks/useProgreso";
import type { RegistroMedidas } from "@/hooks/useProgreso";

/* ─── Schemas de validación ────────────────────────────────────────────────── */

/**
 * Preprocessing para campos numéricos opcionales.
 * Convierte string vacío/undefined/null → undefined para que Zod lo trate
 * como campo no enviado, en lugar de fallar con "NaN no es un número".
 */
const optionalPositiveFloat = z.preprocess(
  (val) => {
    if (val === "" || val === undefined || val === null) return undefined;
    const n = Number(val);
    return isNaN(n) ? undefined : n;
  },
  z.number().positive("Debe ser un número positivo").optional(),
);

const pesoSchema = z.object({
  peso: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z
      .number({ required_error: "Ingresá tu peso" })
      .positive("El peso debe ser positivo")
      .min(20, "El peso mínimo es 20 kg")
      .max(500, "El peso máximo es 500 kg"),
  ),
  fecha: z.string().min(1, "Seleccioná una fecha"),
  nota: z
    .string()
    .max(500, "La nota no puede superar 500 caracteres")
    .optional(),
});

/**
 * Schema de medidas con validación cruzada: al menos un campo debe tener valor.
 * superRefine permite agregar errores condicionales con control total del path.
 */
const medidasSchema = z
  .object({
    cintura: optionalPositiveFloat,
    cadera: optionalPositiveFloat,
    pecho: optionalPositiveFloat,
    brazo: optionalPositiveFloat,
    muslo: optionalPositiveFloat,
    fecha: z.string().min(1, "Seleccioná una fecha"),
  })
  .superRefine((data, ctx) => {
    const tieneMedida = [
      data.cintura,
      data.cadera,
      data.pecho,
      data.brazo,
      data.muslo,
    ].some((v) => v !== undefined);

    if (!tieneMedida) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Completá al menos una medida",
        path: ["_global"],
      });
    }
  });

type PesoFormData = z.infer<typeof pesoSchema>;
type MedidasFormData = z.infer<typeof medidasSchema> & {
  _global?: string; // campo virtual solo para capturar el error de superRefine
};

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

/** Devuelve la fecha de hoy en formato "YYYY-MM-DD" para el input type="date" */
/** Fecha de hoy en formato "YYYY-MM-DD" según hora local (no UTC) */
function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Formatea una fecha ISO a "15 abr" en español argentino */
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

/**
 * Clase Tailwind compartida para todos los inputs de la página.
 * Factor común extraído para no repetir la cadena larga en cada elemento.
 */
const inputBase =
  "w-full rounded-xl border border-cream-dark bg-white/60 px-4 py-3 font-sans text-sm text-ink outline-none transition-all placeholder:text-ink-muted/40 focus:border-forest-mid focus:bg-white focus:shadow-[0_0_0_3px_#1E563118]";

/* ─── Tab toggle ───────────────────────────────────────────────────────────── */

/**
 * TabToggle — selector de sección entre "Peso" y "Medidas".
 * Pill visual con fondo activo bosque / inactivo transparente.
 */
function TabToggle({
  tab,
  onChange,
}: {
  tab: "peso" | "medidas";
  onChange: (t: "peso" | "medidas") => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-cream-dark bg-cream-dark/50 p-1">
      {(["peso", "medidas"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`rounded-full px-6 py-2 font-sans text-sm font-medium transition-all duration-200 ${
            tab === t
              ? "bg-forest text-cream shadow-sm"
              : "text-ink-muted hover:text-forest"
          }`}
        >
          {t === "peso" ? "Peso" : "Medidas"}
        </button>
      ))}
    </div>
  );
}

/* ─── Campo de formulario reutilizable ─────────────────────────────────────── */

/**
 * Field — envuelve label + input + unidad + mensaje de error.
 * El children es el input concreto (para no perder el ref de RHF).
 */
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
      {error && <p className="mt-1.5 font-sans text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ─── Formulario de peso ───────────────────────────────────────────────────── */

/**
 * FormPeso — registra un nuevo peso del usuario.
 *
 * Flujo:
 * 1. Usuario completa peso (obligatorio), fecha (default hoy), nota (opcional)
 * 2. POST /progreso/peso → backend persiste y devuelve { data: RegistroPeso }
 * 3. Se invalida queryKey ["pesos"] → HistorialPeso se refresca automáticamente
 * 4. El formulario se resetea a sus valores por defecto
 */
function FormPeso() {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PesoFormData>({
    resolver: zodResolver(pesoSchema),
    defaultValues: { fecha: getTodayISO() },
  });

  const mutation = useMutation({
    mutationFn: async (data: PesoFormData) => {
      await api.post("/progreso/peso", {
        peso: data.peso,
        fecha: data.fecha,
        ...(data.nota?.trim() ? { nota: data.nota.trim() } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pesos"] });
      reset({ peso: undefined, fecha: getTodayISO(), nota: "" });
    },
  });

  return (
    <div className="rounded-2xl border border-cream-dark bg-white/60 p-6">
      <h2 className="mb-1 font-heading italic text-xl text-forest">
        Nuevo registro
      </h2>
      <p className="mb-5 font-sans text-xs text-ink-muted">
        Cada entrada suma. ¡Seguís construyendo tu historial!
      </p>

      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="space-y-4"
      >
        <Field label="Peso" unit="kg" error={errors.peso?.message}>
          <input
            type="number"
            step="0.1"
            placeholder="72.5"
            className={inputBase}
            {...register("peso")}
          />
        </Field>

        <Field label="Fecha" error={errors.fecha?.message}>
          <input type="date" className={inputBase} {...register("fecha")} />
        </Field>

        <Field label="Nota (opcional)" error={errors.nota?.message}>
          <textarea
            rows={3}
            placeholder="Cómo te sentiste, qué comiste, algún detalle…"
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
            Peso registrado correctamente.
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-full bg-forest py-3 font-sans text-sm font-medium text-cream transition-all hover:bg-forest-mid disabled:opacity-60"
        >
          {mutation.isPending ? "Guardando…" : "Guardar peso"}
        </button>
      </form>
    </div>
  );
}

/* ─── Formulario de medidas ────────────────────────────────────────────────── */

/** Campos de medidas que el usuario puede completar */
const CAMPOS_MEDIDA = [
  { key: "cintura", label: "Cintura" },
  { key: "cadera", label: "Cadera" },
  { key: "pecho", label: "Pecho" },
  { key: "brazo", label: "Brazo" },
  { key: "muslo", label: "Muslo" },
] as const;

type CampoMedidaKey = (typeof CAMPOS_MEDIDA)[number]["key"];

/**
 * FormMedidas — registra medidas corporales (cintura, cadera, pecho, brazo, muslo).
 *
 * Todos los campos de medidas son opcionales individualmente, pero al menos
 * uno debe tener valor para que el formulario sea válido.
 *
 * POST /progreso/medidas → invalida queryKey ["medidas"] al completar.
 */
function FormMedidas() {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MedidasFormData>({
    resolver: zodResolver(medidasSchema),
    defaultValues: { fecha: getTodayISO() },
  });

  const mutation = useMutation({
    mutationFn: async (data: MedidasFormData) => {
      // Solo enviar los campos que el usuario completó (omitir undefined)
      const body: Record<string, unknown> = { fecha: data.fecha };
      for (const { key } of CAMPOS_MEDIDA) {
        if (data[key] !== undefined) body[key] = data[key];
      }
      await api.post("/progreso/medidas", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medidas"] });
      reset({ fecha: getTodayISO() });
    },
  });

  // El error global de "al menos una medida" viene del superRefine con path "_global"
  const globalError = (errors as Record<string, { message?: string }>)._global
    ?.message;

  return (
    <div className="rounded-2xl border border-cream-dark bg-white/60 p-6">
      <h2 className="mb-1 font-heading italic text-xl text-forest">
        Nuevo registro
      </h2>
      <p className="mb-5 font-sans text-xs text-ink-muted">
        Completá las que tengas. No hace falta medirlo todo cada vez.
      </p>

      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="space-y-4"
      >
        {/* Grid de medidas — 2 columnas en pantallas pequeñas */}
        <div className="grid grid-cols-2 gap-3">
          {CAMPOS_MEDIDA.map(({ key, label }) => (
            <div key={key}>
              <label className="mb-1.5 block font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">
                {label}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  placeholder="—"
                  className={inputBase}
                  {...register(key)}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-sans text-xs text-ink-muted">
                  cm
                </span>
              </div>
              {errors[key] && (
                <p className="mt-1 font-sans text-xs text-red-500">
                  {errors[key]?.message}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Error global: falta completar al menos una medida */}
        {globalError && (
          <p className="font-sans text-xs text-red-500">{globalError}</p>
        )}

        <Field label="Fecha" error={errors.fecha?.message}>
          <input type="date" className={inputBase} {...register("fecha")} />
        </Field>

        {mutation.isError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 font-sans text-xs text-red-600">
            Ocurrió un error. Verificá tu conexión e intentá de nuevo.
          </p>
        )}

        {mutation.isSuccess && (
          <p className="rounded-xl bg-forest-pale px-4 py-3 font-sans text-xs text-forest">
            Medidas guardadas correctamente.
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-full bg-forest py-3 font-sans text-sm font-medium text-cream transition-all hover:bg-forest-mid disabled:opacity-60"
        >
          {mutation.isPending ? "Guardando…" : "Guardar medidas"}
        </button>
      </form>
    </div>
  );
}

/* ─── Historial de pesos ───────────────────────────────────────────────────── */

/**
 * HistorialPeso — lista los últimos 10 pesos del usuario.
 *
 * Usa un timeline vertical: línea izquierda + dot por entrada.
 * El registro más reciente (índice 0) tiene dot ámbar, los demás verde-claro.
 */
function HistorialPeso() {
  const { data, isLoading } = usePesos(10);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-cream-dark bg-white/60 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-forest-pale">
          <span className="text-2xl">📈</span>
        </div>
        <p className="font-heading italic text-lg text-forest">
          Sin registros todavía
        </p>
        <p className="mt-1 max-w-xs font-sans text-xs text-ink-muted">
          Tu historial de peso va a aparecer acá después de tu primer registro.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cream-dark bg-white/60 p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-heading italic text-lg text-forest">
          Historial de peso
        </h3>
        <span className="rounded-full bg-cream-dark px-3 py-1 font-sans text-xs text-ink-muted">
          {data.meta.total} {data.meta.total === 1 ? "registro" : "registros"} en
          total
        </span>
      </div>

      {/* Timeline vertical */}
      <div className="relative">
        {/* Línea de timeline */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-cream-dark" />

        <div className="space-y-1">
          {data.items.map((item, idx) => (
            <div key={item.id} className="relative flex gap-4 pl-6 pb-5 last:pb-0">
              {/* Dot del timeline */}
              <div
                className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                  idx === 0 ? "bg-amber" : "bg-forest-light"
                }`}
              />

              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-heading italic text-2xl leading-none text-forest">
                    {item.peso}
                    <span className="ml-1 font-sans text-sm not-italic text-ink-muted">
                      kg
                    </span>
                  </p>
                  <span className="shrink-0 rounded-full bg-cream-dark px-2.5 py-0.5 font-sans text-[11px] text-ink-muted">
                    {formatFecha(item.fecha)}
                  </span>
                </div>

                {item.nota && (
                  <p className="mt-1.5 font-sans text-xs italic text-ink-muted">
                    &ldquo;{item.nota}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Historial de medidas ─────────────────────────────────────────────────── */

/** Mapa de campos de medidas con su etiqueta legible */
const CAMPOS_MEDIDA_DISPLAY: Array<{
  key: CampoMedidaKey;
  label: string;
}> = [
  { key: "cintura", label: "Cintura" },
  { key: "cadera", label: "Cadera" },
  { key: "pecho", label: "Pecho" },
  { key: "brazo", label: "Brazo" },
  { key: "muslo", label: "Muslo" },
];

/**
 * HistorialMedidas — muestra las últimas 5 sesiones de medidas del usuario.
 *
 * Cada sesión puede tener distinto conjunto de campos completados.
 * Solo se muestran los campos con valor (no null/undefined).
 */
function HistorialMedidas() {
  const { data, isLoading } = useMedidas(5);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-cream-dark bg-white/60 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-forest-pale">
          <span className="text-2xl">📏</span>
        </div>
        <p className="font-heading italic text-lg text-forest">
          Sin medidas registradas
        </p>
        <p className="mt-1 max-w-xs font-sans text-xs text-ink-muted">
          Registrá tus primeras medidas para ver tu evolución corporal.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cream-dark bg-white/60 p-6">
      <h3 className="mb-5 font-heading italic text-lg text-forest">
        Historial de medidas
      </h3>

      <div className="space-y-3">
        {data.items.map((item: RegistroMedidas) => {
          const camposConValor = CAMPOS_MEDIDA_DISPLAY.filter(
            ({ key }) => item[key] != null,
          );

          return (
            <div
              key={item.id}
              className="rounded-xl border border-cream-dark/60 bg-cream/40 p-4"
            >
              {/* Cabecera de la sesión */}
              <div className="mb-3 flex items-center justify-between">
                <span className="font-heading italic text-base text-forest">
                  {formatFecha(item.fecha)}
                </span>
                <span className="rounded-full bg-cream-dark px-2.5 py-0.5 font-sans text-[11px] text-ink-muted">
                  {camposConValor.length}{" "}
                  {camposConValor.length === 1 ? "medida" : "medidas"}
                </span>
              </div>

              {/* Grid de valores */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                {camposConValor.map(({ key, label }) => (
                  <div key={key}>
                    <p className="mb-0.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                      {label}
                    </p>
                    <p className="font-heading italic text-xl leading-none text-forest">
                      {item[key]}
                      <span className="ml-0.5 font-sans text-xs not-italic text-ink-muted">
                        cm
                      </span>
                    </p>
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
 * ProgresoPage — página de seguimiento de progreso corporal.
 *
 * El estado del tab activo ("peso" | "medidas") vive en este componente.
 * Al cambiar de tab, se usa `key={tab}` en el grid para que React desmonte
 * y remonte los hijos, disparando la animación de entrada y reseteando
 * el estado local de éxito/error de las mutaciones.
 */
export default function ProgresoPage() {
  const [tab, setTab] = useState<"peso" | "medidas">("peso");

  return (
    <div className="max-w-5xl space-y-6">
      {/* ── Encabezado ── */}
      <header>
        <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-widest text-amber">
          Tu cuerpo en números
        </p>
        <h1 className="font-heading italic text-4xl font-semibold leading-tight text-forest">
          Progreso
        </h1>
      </header>

      {/* ── Selector de tab ── */}
      <TabToggle tab={tab} onChange={setTab} />

      {/* ── Layout de dos columnas: formulario (izq) + historial (der) ── */}
      <div key={tab} className="grid animate-fade-in grid-cols-1 gap-6 lg:grid-cols-5">
        {tab === "peso" ? (
          <>
            <div className="lg:col-span-2">
              <FormPeso />
            </div>
            <div className="lg:col-span-3">
              <HistorialPeso />
            </div>
          </>
        ) : (
          <>
            <div className="lg:col-span-2">
              <FormMedidas />
            </div>
            <div className="lg:col-span-3">
              <HistorialMedidas />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

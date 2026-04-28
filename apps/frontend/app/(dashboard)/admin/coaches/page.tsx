/**
 * CoachesAdminPage — gestión completa de coaches para el rol ADMIN.
 *
 * Funcionalidades:
 * - Lista de coaches (tarjetas clickeables)
 * - Drawer lateral al seleccionar un coach: editar especialidad, ver pacientes, convertir a paciente
 * - Modal de creación de nuevo coach (RHF + Zod)
 * - Modal de confirmación para la conversión a paciente (acción destructiva)
 *
 * Guard de rol: si el usuario no es ADMIN, redirige a /dashboard.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/stores/auth.store";
import {
  useCoaches,
  useCrearCoach,
  useEditarCoach,
  useConvertirAPaciente,
  usePacientes,
  type CoachItem,
  type CreateCoachDto,
  type PacienteItem,
} from "@/hooks/useAdmin";

/* ─── Esquema de validación del formulario de creación ─────────────────────── */

const schema = z.object({
  nombre: z.string().min(1, "Requerido"),
  apellido: z.string().min(1, "Requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  especialidad: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

/* ─── Sub-componente: tarjeta de coach (clickeable) ───────────────────────── */

/**
 * Tarjeta clickeable de coach que abre el drawer al presionar.
 * El chevron derecho indica que es interactiva.
 */
function CoachCard({ coach, onClick }: { coach: CoachItem; onClick: () => void }) {
  const inicial = coach.nombre[0]?.toUpperCase() ?? "?";

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-2xl border border-cream-dark bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-forest/20 hover:shadow-md"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-forest/10 transition-colors group-hover:bg-forest/15">
        <span className="font-heading italic text-xl font-semibold text-forest">{inicial}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-sm font-semibold text-ink">
          {coach.nombre} {coach.apellido}
        </p>
        {coach.usuarioCoach && (
          <p className="truncate font-sans text-xs text-ink-muted">{coach.usuarioCoach.email}</p>
        )}
        {coach.especialidad && (
          <p className="mt-0.5 font-sans text-xs text-forest-light">{coach.especialidad}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/15 px-3 py-1 font-sans text-xs font-semibold text-amber-light">
          {coach._count.pacientes} {coach._count.pacientes === 1 ? "paciente" : "pacientes"}
        </span>
        <svg
          className="h-4 w-4 text-ink-muted/40 transition-colors group-hover:text-ink-muted"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </button>
  );
}

/* ─── Sub-componente: wrapper de campo de formulario ──────────────────────── */

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-sans text-xs font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      {children}
      {error && <p className="font-sans text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ─── Drawer lateral de detalle/edición del coach ─────────────────────────── */

/**
 * Panel deslizante desde la derecha con el detalle de un coach.
 * Permite editar la especialidad, ver los pacientes asignados y convertir al coach en paciente.
 * El componente padre maneja el overlay y controla si el drawer está visible.
 */
function CoachDrawer({
  coach,
  pacientesDelCoach,
  onClose,
}: {
  coach: CoachItem;
  pacientesDelCoach: PacienteItem[];
  onClose: () => void;
}) {
  const [especialidadDraft, setEspecialidadDraft] = useState(coach.especialidad ?? "");
  const [savedOk, setSavedOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmarConversion, setConfirmarConversion] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);

  const editarCoach = useEditarCoach();
  const convertirAPaciente = useConvertirAPaciente();

  const inicial = coach.nombre[0]?.toUpperCase() ?? "?";

  // Resetear estado del draft cuando cambia el coach seleccionado
  useEffect(() => {
    setEspecialidadDraft(coach.especialidad ?? "");
    setSavedOk(false);
    setSaveError(null);
    setConfirmarConversion(false);
    setConversionError(null);
  }, [coach.id, coach.especialidad]);

  const isDirty = especialidadDraft !== (coach.especialidad ?? "");

  const handleGuardar = async () => {
    setSaveError(null);
    try {
      await editarCoach.mutateAsync({ coachId: coach.id, dto: { especialidad: especialidadDraft } });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch {
      setSaveError("Error al guardar");
    }
  };

  const handleConvertir = async () => {
    setConversionError(null);
    try {
      await convertirAPaciente.mutateAsync({ coachId: coach.id });
      onClose();
    } catch {
      setConversionError("Error al convertir el coach. Intentá de nuevo.");
    }
  };

  return (
    <>
      {/* Panel del drawer */}
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col bg-cream shadow-2xl shadow-ink/20">
        {/* Header del drawer */}
        <div className="flex items-center gap-3 border-b border-cream-dark px-5 py-4">
          <button
            onClick={onClose}
            aria-label="Cerrar panel"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-cream-dark hover:text-ink"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <span className="font-sans text-sm font-medium text-ink-muted">Detalle del coach</span>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Perfil del coach */}
          <div className="px-5 py-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-forest/10">
                <span className="font-heading italic text-3xl font-semibold text-forest">{inicial}</span>
              </div>
              <div className="min-w-0">
                <h2 className="font-heading italic text-xl font-semibold text-ink">
                  {coach.nombre} {coach.apellido}
                </h2>
                {coach.usuarioCoach && (
                  <p className="font-sans text-sm text-ink-muted">{coach.usuarioCoach.email}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6 px-5 pb-6">
            {/* Editar especialidad */}
            <div>
              <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Especialidad
              </p>
              <div className="flex gap-2">
                <input
                  value={especialidadDraft}
                  onChange={(e) => {
                    setEspecialidadDraft(e.target.value);
                    setSaveError(null);
                  }}
                  placeholder="Sin especialidad"
                  className="min-w-0 flex-1 rounded-xl border border-cream-dark bg-white px-3.5 py-2.5 font-sans text-sm text-ink placeholder:text-ink-muted/40 outline-none transition-all focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
                />
                <button
                  onClick={handleGuardar}
                  disabled={!isDirty || editarCoach.isPending}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-forest px-3.5 py-2.5 font-sans text-xs font-medium text-cream transition-all hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {editarCoach.isPending ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cream border-t-transparent" />
                  ) : savedOk ? (
                    <svg className="h-4 w-4 text-green-300" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    "Guardar"
                  )}
                </button>
              </div>
              {saveError && (
                <p className="mt-1.5 font-sans text-xs text-red-500">{saveError}</p>
              )}
            </div>

            {/* Lista de pacientes asignados */}
            <div>
              <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Pacientes ({coach._count.pacientes})
              </p>
              {pacientesDelCoach.length > 0 ? (
                <ul className="space-y-1.5">
                  {pacientesDelCoach.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2.5 rounded-xl bg-cream-dark/60 px-3.5 py-2.5"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest/10">
                        <span className="font-sans text-[10px] font-semibold text-forest">
                          {p.nombre[0]?.toUpperCase()}
                        </span>
                      </div>
                      <span className="font-sans text-sm text-ink">
                        {p.nombre} {p.apellido}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-sans text-sm italic text-ink-muted/60">
                  Sin pacientes asignados
                </p>
              )}
            </div>

            {/* Zona de peligro */}
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-wider text-red-600">
                Zona de peligro
              </p>
              <p className="mb-3 font-sans text-xs text-red-500">
                Al convertir este coach en paciente, sus{" "}
                <strong>{coach._count.pacientes}</strong>{" "}
                {coach._count.pacientes === 1 ? "paciente" : "pacientes"} quedarán sin coach
                asignado y el perfil será eliminado.
              </p>
              <button
                onClick={() => setConfirmarConversion(true)}
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 font-sans text-sm font-medium text-red-600 transition-all hover:border-red-600 hover:bg-red-600 hover:text-white"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Convertir a Paciente
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Modal de confirmación de conversión */}
      {confirmarConversion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={() => setConfirmarConversion(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-cream p-6 shadow-2xl">
            {/* Ícono de advertencia */}
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <h3 className="font-heading italic text-lg font-semibold text-ink">
              ¿Convertir a {coach.nombre} {coach.apellido} en paciente?
            </h3>
            <p className="mt-2 font-sans text-sm text-ink-muted">
              Sus{" "}
              <strong className="text-ink">
                {coach._count.pacientes} {coach._count.pacientes === 1 ? "paciente" : "pacientes"}
              </strong>{" "}
              quedarán sin coach asignado y el perfil de coach será eliminado. Esta acción no
              se puede deshacer.
            </p>

            {conversionError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 font-sans text-xs text-red-600">
                {conversionError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmarConversion(false)}
                className="rounded-xl px-4 py-2.5 font-sans text-sm text-ink-muted transition-all hover:bg-cream-dark"
              >
                Cancelar
              </button>
              <button
                onClick={handleConvertir}
                disabled={convertirAPaciente.isPending}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 font-sans text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-60"
              >
                {convertirAPaciente.isPending && (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {convertirAPaciente.isPending ? "Convirtiendo..." : "Sí, convertir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Página principal ────────────────────────────────────────────────────── */

export default function CoachesAdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<CoachItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const accessToken = useAuthStore((s) => s.accessToken);
  const usuario = useAuthStore((s) => s.usuario);

  const { data: coaches, isLoading } = useCoaches();
  const { data: pacientes } = usePacientes();
  const crearCoach = useCrearCoach();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (!accessToken || usuario?.rol !== "ADMIN")) {
      router.push("/dashboard");
    }
  }, [mounted, accessToken, usuario, router]);

  // Sincronizar selectedCoach con los datos frescos luego de una edición o recarga
  useEffect(() => {
    if (!coaches) return;
    setSelectedCoach((prev) => {
      if (!prev) return null;
      return coaches.find((c) => c.id === prev.id) ?? prev;
    });
  }, [coaches]);

  if (!mounted || !accessToken || usuario?.rol !== "ADMIN") return null;

  const pacientesDelCoachSeleccionado = selectedCoach
    ? (pacientes ?? []).filter((p) => p.coach?.id === selectedCoach.id)
    : [];

  const openModal = () => {
    reset();
    setServerError(null);
    setModalOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await crearCoach.mutateAsync(data as CreateCoachDto);
      reset();
      setModalOpen(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Error al crear el coach";
      setServerError(message);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-cream-dark bg-cream px-3.5 py-2.5 font-sans text-sm text-ink placeholder:text-ink-muted/50 outline-none focus:border-forest/40 focus:ring-2 focus:ring-forest/10 transition-all";

  return (
    <>
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="mb-1 font-sans text-xs uppercase tracking-widest text-ink-muted">
              Administración
            </p>
            <h1 className="font-heading italic text-3xl font-semibold text-forest">Coaches</h1>
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 font-sans text-sm font-medium text-cream transition-all hover:bg-forest/90 active:scale-95"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Nuevo coach
          </button>
        </div>

        {/* Lista de coaches */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-forest border-t-transparent" />
          </div>
        ) : coaches && coaches.length > 0 ? (
          <div className="flex flex-col gap-3">
            {coaches.map((coach: CoachItem) => (
              <CoachCard
                key={coach.id}
                coach={coach}
                onClick={() => setSelectedCoach(coach)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-cream-dark py-20 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-forest/10">
              <svg className="h-7 w-7 text-forest/40" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </div>
            <p className="font-heading italic text-lg text-ink-muted">
              No hay coaches registrados
            </p>
            <p className="mt-1 font-sans text-sm text-ink-muted/60">
              Creá el primer coach para comenzar
            </p>
          </div>
        )}
      </div>

      {/* Overlay + Drawer (montado cuando hay un coach seleccionado) */}
      {selectedCoach && (
        <>
          <div
            className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-sm"
            onClick={() => setSelectedCoach(null)}
          />
          <CoachDrawer
            coach={selectedCoach}
            pacientesDelCoach={pacientesDelCoachSeleccionado}
            onClose={() => setSelectedCoach(null)}
          />
        </>
      )}

      {/* Modal de creación de coach */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-cream shadow-2xl">
            <div className="border-b border-cream-dark px-6 py-5">
              <h2 className="font-heading italic text-xl font-semibold text-forest">
                Nuevo coach
              </h2>
              <p className="mt-0.5 font-sans text-sm text-ink-muted">
                Los coaches acceden al panel con su email y contraseña.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre" error={errors.nombre?.message}>
                  <input {...register("nombre")} className={inputClass} placeholder="María" />
                </Field>
                <Field label="Apellido" error={errors.apellido?.message}>
                  <input {...register("apellido")} className={inputClass} placeholder="García" />
                </Field>
              </div>
              <Field label="Email" error={errors.email?.message}>
                <input
                  {...register("email")}
                  type="email"
                  className={inputClass}
                  placeholder="coach@ejemplo.com"
                />
              </Field>
              <Field label="Contraseña" error={errors.password?.message}>
                <input
                  {...register("password")}
                  type="password"
                  className={inputClass}
                  placeholder="Mínimo 8 caracteres"
                />
              </Field>
              <Field label="Especialidad (opcional)" error={errors.especialidad?.message}>
                <input
                  {...register("especialidad")}
                  className={inputClass}
                  placeholder="Nutricionista, Entrenador..."
                />
              </Field>

              {serverError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 font-sans text-xs text-red-600">
                  {serverError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 font-sans text-sm text-ink-muted transition-all hover:bg-cream-dark"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={crearCoach.isPending}
                  className="flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 font-sans text-sm font-medium text-cream transition-all hover:bg-forest/90 disabled:opacity-60"
                >
                  {crearCoach.isPending && (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cream border-t-transparent" />
                  )}
                  {crearCoach.isPending ? "Creando..." : "Crear coach"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * PacientesAdminPage — gestión de asignación de coaches a pacientes.
 *
 * Lista todos los usuarios con rol=USUARIO y permite al ADMIN asignar o
 * desasignar un coach a cada uno. El selector muestra todos los coaches
 * disponibles; el botón "Asignar" llama a POST /admin/pacientes/:id/asignar-coach.
 *
 * Guard de rol: si el usuario no es ADMIN, redirige a /dashboard.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import {
  useCoaches,
  usePacientes,
  useAsignarCoach,
  useDesasignarCoach,
  type CoachItem,
  type PacienteItem,
} from "@/hooks/useAdmin";

/* ─── Sub-componente: fila de paciente ────────────────────────────────────── */

/**
 * Fila de un paciente en la lista de gestión.
 * Muestra datos del paciente, el coach asignado (si hay) y controles para asignar/desasignar.
 */
function PacienteRow({
  paciente,
  coaches,
  selectedCoachId,
  onSelect,
  onAsignar,
  onDesasignar,
  isAsignando,
  isDesasignando,
}: {
  paciente: PacienteItem;
  coaches: CoachItem[];
  selectedCoachId: string;
  onSelect: (id: string) => void;
  onAsignar: () => void;
  onDesasignar: () => void;
  isAsignando: boolean;
  isDesasignando: boolean;
}) {
  const inicial = paciente.nombre[0]?.toUpperCase() ?? "?";

  return (
    <div className="rounded-2xl border border-cream-dark bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        {/* Avatar e info del paciente */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream-dark">
            <span className="font-sans text-sm font-semibold text-ink-muted">
              {inicial}
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate font-sans text-sm font-semibold text-ink">
              {paciente.nombre} {paciente.apellido}
            </p>
            <p className="truncate font-sans text-xs text-ink-muted">
              {paciente.email}
            </p>
          </div>
        </div>

        {/* Estado de asignación */}
        <div className="flex shrink-0 items-center gap-2">
          {paciente.coach ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/10 px-2.5 py-1 font-sans text-xs text-forest">
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
                {paciente.coach.nombre} {paciente.coach.apellido}
              </span>
              <button
                onClick={onDesasignar}
                disabled={isDesasignando}
                className="font-sans text-xs text-red-400 transition-colors hover:text-red-600 disabled:opacity-50"
              >
                {isDesasignando ? "Quitando..." : "Quitar"}
              </button>
            </>
          ) : (
            <span className="font-sans text-xs italic text-ink-muted/50">
              Sin coach
            </span>
          )}
        </div>

        {/* Selector + botón asignar */}
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={selectedCoachId}
            onChange={(e) => onSelect(e.target.value)}
            className="rounded-xl border border-cream-dark bg-cream px-3 py-2 font-sans text-xs text-ink outline-none transition-all focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
          >
            <option value="">Seleccionar coach</option>
            {coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.nombre} {coach.apellido}
              </option>
            ))}
          </select>
          <button
            onClick={onAsignar}
            disabled={!selectedCoachId || isAsignando}
            className="rounded-xl bg-amber/15 px-3 py-2 font-sans text-xs font-medium text-amber-light transition-all hover:bg-amber/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isAsignando ? "..." : "Asignar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Página principal ────────────────────────────────────────────────────── */

export default function PacientesAdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  /**
   * Selección de coach por paciente: Record<pacienteId, coachId seleccionado>.
   * Se limpia al asignar exitosamente para volver el dropdown a su estado vacío.
   */
  const [selections, setSelections] = useState<Record<string, string>>({});

  const accessToken = useAuthStore((s) => s.accessToken);
  const usuario = useAuthStore((s) => s.usuario);

  const { data: pacientes, isLoading } = usePacientes();
  const { data: coaches } = useCoaches();
  const asignarCoach = useAsignarCoach();
  const desasignarCoach = useDesasignarCoach();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (!accessToken || usuario?.rol !== "ADMIN")) {
      router.push("/dashboard");
    }
  }, [mounted, accessToken, usuario, router]);

  if (!mounted || !accessToken || usuario?.rol !== "ADMIN") return null;

  const handleAsignar = async (pacienteId: string) => {
    const coachId = selections[pacienteId];
    if (!coachId) return;
    await asignarCoach.mutateAsync({ pacienteId, coachId });
    setSelections((prev) => {
      const next = { ...prev };
      delete next[pacienteId];
      return next;
    });
  };

  const handleDesasignar = async (pacienteId: string) => {
    await desasignarCoach.mutateAsync({ pacienteId });
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <p className="mb-1 font-sans text-xs uppercase tracking-widest text-ink-muted">
          Administración
        </p>
        <h1 className="font-heading italic text-3xl font-semibold text-forest">
          Pacientes
        </h1>
      </div>

      {/* Lista de pacientes */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-forest border-t-transparent" />
        </div>
      ) : pacientes && pacientes.length > 0 ? (
        <div className="flex flex-col gap-3">
          {pacientes.map((paciente: PacienteItem) => (
            <PacienteRow
              key={paciente.id}
              paciente={paciente}
              coaches={coaches ?? []}
              selectedCoachId={selections[paciente.id] ?? ""}
              onSelect={(id) =>
                setSelections((prev) => ({ ...prev, [paciente.id]: id }))
              }
              onAsignar={() => handleAsignar(paciente.id)}
              onDesasignar={() => handleDesasignar(paciente.id)}
              isAsignando={
                asignarCoach.isPending &&
                asignarCoach.variables?.pacienteId === paciente.id
              }
              isDesasignando={
                desasignarCoach.isPending &&
                desasignarCoach.variables?.pacienteId === paciente.id
              }
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-cream-dark py-20 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-forest/10">
            <svg
              className="h-7 w-7 text-forest/40"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="font-heading italic text-lg text-ink-muted">
            No hay pacientes registrados
          </p>
        </div>
      )}
    </div>
  );
}

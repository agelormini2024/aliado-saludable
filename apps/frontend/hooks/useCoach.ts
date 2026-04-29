/**
 * useCoach — hooks Tanstack Query para el panel de coach.
 *
 * Gestiona la lista de pacientes asignados al coach autenticado
 * y el detalle/resumen de cada paciente.
 *
 * Todos los endpoints requieren rol COACH en el backend; el guard del
 * layout `(coach)/layout.tsx` garantiza que solo coaches lleguen aquí.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ─── Tipos ───────────────────────────────────────────────────────────────── */

/**
 * Paciente tal como lo devuelve `GET /coaches/mis-pacientes`.
 * `ultimoPeso` es null cuando el paciente aún no registró ningún peso.
 * `actividadReciente` es la cantidad de registros (peso + comida + actividad)
 * en los últimos 7 días — sirve para el badge de nivel de actividad.
 */
export interface PacienteCoach {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  ultimoPeso: { peso: number; fecha: string } | null;
  actividadReciente: number;
}

/* ─── Tipos detalle ───────────────────────────────────────────────────────── */

/**
 * Resumen completo de un paciente tal como lo devuelve
 * `GET /coaches/pacientes/:id/resumen`.
 */
export interface ResumenPacienteDetalle {
  usuario: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    altura: number | null;
    fechaNacimiento: string | null;
    meta: number | null;
    createdAt: string;
  };
  /** Últimos 10 registros de peso, del más reciente al más antiguo. */
  ultimosPesos: Array<{
    id: string;
    peso: number;
    fecha: string;
    nota: string | null;
  }>;
  /** Último registro de medidas corporales, o null si no hay ninguno. */
  ultimasMedidas: {
    cintura: number | null;
    cadera: number | null;
    pecho: number | null;
    brazo: number | null;
    muslo: number | null;
    fecha: string;
  } | null;
  /** Últimas 7 actividades registradas. */
  actividadReciente: Array<{
    id: string;
    tipo: string;
    duracion: number;
    calorias: number;
    fecha: string;
    nota: string | null;
  }>;
  /** Comidas registradas hoy. */
  comidasHoy: Array<{
    id: string;
    momento: string;
    descripcion: string;
    calorias: number;
    fecha: string;
  }>;
  /** Balance calórico de hoy: consumidas - quemadas. */
  balanceHoy: {
    consumidas: number;
    quemadas: number;
    balance: number;
  };
}

/* ─── Queries ─────────────────────────────────────────────────────────────── */

/**
 * Devuelve la lista de pacientes asignados al coach autenticado.
 * Incluye el último peso registrado y el conteo de actividad reciente (7 días).
 *
 * Endpoint: `GET /coaches/mis-pacientes`
 * Response: `{ data: PacienteCoach[] }`
 */
/**
 * Devuelve el resumen completo de un paciente para la vista de detalle del coach.
 * Solo se ejecuta cuando `pacienteId` tiene valor (enabled: !!pacienteId).
 * El backend valida que el paciente esté asignado al coach — devuelve 403 si no.
 *
 * Endpoint: `GET /coaches/pacientes/:id/resumen`
 * Response: `{ data: ResumenPacienteDetalle }`
 */
export function useResumenPaciente(pacienteId: string) {
  return useQuery({
    queryKey: ["coach-paciente-resumen", pacienteId],
    queryFn: async () => {
      const res = await api.get<{ data: ResumenPacienteDetalle }>(
        `/coaches/pacientes/${pacienteId}/resumen`,
      );
      return res.data.data;
    },
    enabled: !!pacienteId,
  });
}

export function useMisPacientes() {
  return useQuery({
    queryKey: ["coach-pacientes"],
    queryFn: async () => {
      const res = await api.get<{ data: PacienteCoach[] }>("/coaches/mis-pacientes");
      return res.data.data;
    },
  });
}

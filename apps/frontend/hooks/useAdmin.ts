/**
 * useAdmin — hooks Tanstack Query para el módulo de administración.
 *
 * Gestiona coaches (creación, listado) y la asignación de coaches a pacientes.
 * Todos los endpoints requieren rol ADMIN en el backend; el guard de rol en
 * cada página garantiza que solo usuarios ADMIN lleguen a consumir estos hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ─── Tipos ───────────────────────────────────────────────────────────────── */

/**
 * Perfil de coach tal como lo devuelve `GET /admin/coaches`.
 * `usuarioCoach` es el Usuario con rol=COACH vinculado al perfil.
 * `_count.pacientes` es la cantidad de pacientes actualmente asignados.
 */
export interface CoachItem {
  id: string;
  nombre: string;
  apellido: string;
  especialidad?: string;
  _count: { pacientes: number };
  usuarioCoach?: {
    id: string;
    email: string;
    nombre: string;
    apellido: string;
  };
}

/**
 * Paciente tal como lo devuelve `GET /admin/pacientes`.
 * Solo incluye usuarios con rol=USUARIO.
 * `coach` es el perfil Coach asignado (null si no tiene).
 */
export interface PacienteItem {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  coach?: {
    id: string;
    nombre: string;
    apellido: string;
  };
}

/** DTO para crear un coach — coincide con `CreateCoachDto` del backend. */
export interface CreateCoachDto {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  especialidad?: string;
}

/* ─── Queries ─────────────────────────────────────────────────────────────── */

/**
 * Devuelve la lista de todos los coaches con su pacienteCount y usuario vinculado.
 * Se usa tanto en la página de coaches como en la de pacientes (para el selector).
 */
export function useCoaches() {
  return useQuery({
    queryKey: ["admin-coaches"],
    queryFn: async () => {
      const res = await api.get<{ data: CoachItem[] }>("/admin/coaches");
      return res.data.data;
    },
  });
}

/**
 * Devuelve la lista de usuarios con rol=USUARIO, incluyendo el coach asignado.
 * Se usa en la página de gestión de pacientes.
 */
export function usePacientes() {
  return useQuery({
    queryKey: ["admin-pacientes"],
    queryFn: async () => {
      const res = await api.get<{ data: PacienteItem[] }>("/admin/pacientes");
      return res.data.data;
    },
  });
}

/** DTO para editar un coach — todos los campos son opcionales. */
export interface UpdateCoachDto {
  nombre?: string;
  apellido?: string;
  especialidad?: string;
}

/* ─── Mutations ───────────────────────────────────────────────────────────── */

/**
 * Crea un coach: crea el perfil Coach + el Usuario con rol=COACH en una transacción.
 * Invalida el cache de coaches al tener éxito.
 */
export function useCrearCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateCoachDto) => {
      const res = await api.post("/admin/coaches", dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coaches"] });
    },
  });
}

/**
 * Edita los datos de un coach (especialidad, nombre, apellido).
 * Los cambios en nombre/apellido se sincronizan al Usuario vinculado en el backend.
 * Invalida el cache de coaches al tener éxito.
 */
export function useEditarCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ coachId, dto }: { coachId: string; dto: UpdateCoachDto }) => {
      const res = await api.patch(`/admin/coaches/${coachId}`, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coaches"] });
    },
  });
}

/**
 * Convierte un coach en usuario regular (paciente).
 * Desafecta todos sus pacientes y elimina el perfil Coach.
 * Invalida tanto coaches como pacientes al tener éxito.
 */
export function useConvertirAPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ coachId }: { coachId: string }) => {
      const res = await api.post(`/admin/coaches/${coachId}/convertir-a-paciente`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coaches"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pacientes"] });
    },
  });
}

/**
 * Asigna un coach a un paciente.
 * `coachId` es el ID del perfil Coach (tabla Coach), no del Usuario-coach.
 * Invalida el cache de pacientes al tener éxito.
 */
export function useAsignarCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pacienteId, coachId }: { pacienteId: string; coachId: string }) => {
      const res = await api.post(`/admin/pacientes/${pacienteId}/asignar-coach`, { coachId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pacientes"] });
    },
  });
}

/**
 * Desasigna el coach de un paciente (establece coachId = null).
 * Invalida el cache de pacientes al tener éxito.
 */
export function useDesasignarCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pacienteId }: { pacienteId: string }) => {
      const res = await api.delete(`/admin/pacientes/${pacienteId}/asignar-coach`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pacientes"] });
    },
  });
}

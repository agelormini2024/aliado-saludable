/**
 * Hooks de Tanstack Query para los endpoints de progreso.
 *
 * La API de progreso devuelve PaginatedResult<T> directamente, sin wrapper { data }:
 * GET /progreso/peso → { items: RegistroPeso[], meta: { total, page, limit, totalPages } }
 *
 * Los registros vienen ordenados por fecha desc (más reciente primero).
 * Para el gráfico hay que invertirlos antes de pasarlos a Recharts.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ─── Tipos ────────────────────────────────────────────────────────────────── */

export interface RegistroPeso {
  id: string;
  usuarioId: string;
  peso: number;
  fecha: string; // ISO 8601
  nota?: string | null;
}

/** Medidas corporales en cm — todos los campos son opcionales por diseño */
export interface RegistroMedidas {
  id: string;
  usuarioId: string;
  cintura?: number | null;
  cadera?: number | null;
  pecho?: number | null;
  brazo?: number | null;
  muslo?: number | null;
  fecha: string; // ISO 8601
}

export interface RegistroActividad {
  id: string;
  usuarioId: string;
  tipo: string; // CAMINATA | GYM | NATACION | CICLISMO | OTRO
  duracion: number; // minutos
  calorias?: number | null;
  fecha: string; // ISO 8601
  nota?: string | null;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

/* ─── Hooks ────────────────────────────────────────────────────────────────── */

/**
 * Devuelve el historial de pesos del usuario autenticado.
 * Default: 30 registros (suficiente para el gráfico del dashboard).
 */
export function usePesos(limit = 30) {
  return useQuery({
    queryKey: ["pesos", limit],
    queryFn: async () => {
      const res = await api.get<PaginatedResult<RegistroPeso>>(
        `/progreso/peso?limit=${limit}&page=1`,
      );
      return res.data;
    },
  });
}

/**
 * Devuelve el historial de medidas corporales del usuario autenticado.
 * Default: 5 registros (para el panel de progreso).
 */
export function useMedidas(limit = 5) {
  return useQuery({
    queryKey: ["medidas", limit],
    queryFn: async () => {
      const res = await api.get<PaginatedResult<RegistroMedidas>>(
        `/progreso/medidas?limit=${limit}&page=1`,
      );
      return res.data;
    },
  });
}

/**
 * Devuelve el historial de actividad física del usuario autenticado.
 * Se usa en el dashboard para calcular días activos en la semana actual.
 */
export function useActividad(limit = 30) {
  return useQuery({
    queryKey: ["actividad", limit],
    queryFn: async () => {
      const res = await api.get<PaginatedResult<RegistroActividad>>(
        `/progreso/actividad?limit=${limit}&page=1`,
      );
      return res.data;
    },
  });
}

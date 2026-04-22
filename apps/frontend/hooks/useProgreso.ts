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

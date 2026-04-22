/**
 * Hooks de Tanstack Query para los endpoints de alimentación.
 *
 * La API de alimentación sí usa wrapper { data }:
 * GET /alimentacion/comidas?fecha=YYYY-MM-DD → { data: RegistroComida[] }
 *
 * Si no se pasa fecha, el backend devuelve las comidas de hoy.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface RegistroComida {
  id: string;
  usuarioId: string;
  momento: string; // DESAYUNO | ALMUERZO | MERIENDA | CENA | SNACK
  descripcion: string;
  calorias?: number | null;
  fecha: string; // ISO 8601
}

/**
 * Devuelve las comidas registradas para la fecha indicada.
 * Si no se pasa fecha, usa hoy (YYYY-MM-DD en hora local).
 */
export function useComidasDelDia(fecha?: string) {
  const fechaParam = fecha ?? new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["comidas", fechaParam],
    queryFn: async () => {
      const res = await api.get<{ data: RegistroComida[] }>(
        `/alimentacion/comidas?fecha=${fechaParam}`,
      );
      return res.data.data;
    },
  });
}

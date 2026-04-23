/**
 * Hooks de Tanstack Query para los endpoints de contenido editorial.
 *
 * La API de contenido sigue el mismo patrón que los endpoints paginados:
 * - Listados → PaginatedResult<T> directamente: { items, meta }
 * - Detalle → wrapper { data: T }
 *
 * GET /contenido/articulos?categoria=&page=&limit= → { items: Articulo[], meta }
 * GET /contenido/articulos/:id                     → { data: Articulo }
 * GET /contenido/documentos?page=&limit=           → { items: Documento[], meta }
 *
 * El campo `contenido` (texto extraído del PDF) se omite en el listado de
 * documentos — puede ser muy largo. Solo aparece en el detalle.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PaginationMeta } from "@/hooks/useProgreso";

/* ─── Tipos ────────────────────────────────────────────────────────────────── */

/** Categorías válidas — deben coincidir con el enum del backend */
export type CategoriaArticulo = "NUTRICION" | "EJERCICIO" | "BIENESTAR";

/**
 * Artículo editorial con texto markdown en `contenido`.
 * El campo `contenido` puede ser largo — en listados se recomienda mostrar
 * solo un excerpt de los primeros N caracteres.
 */
export interface Articulo {
  id: string;
  titulo: string;
  contenido: string; // texto en markdown
  categoria: CategoriaArticulo;
  publicado: boolean;
  autorId?: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Documento PDF/.docx — sin el campo `contenido` (texto extraído).
 * El texto extraído solo se incluye en el endpoint de detalle para
 * mantener el listado liviano.
 */
export interface Documento {
  id: string;
  nombre: string; // nombre original del archivo, ej: "guia-alimentacion.pdf"
  mimeType: string; // "application/pdf" | "...wordprocessingml.document"
  publicado: boolean;
  autorId?: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface ArticulosResult {
  items: Articulo[];
  meta: PaginationMeta;
}

export interface DocumentosResult {
  items: Documento[];
  meta: PaginationMeta;
}

/* ─── Hooks ────────────────────────────────────────────────────────────────── */

/**
 * Devuelve los artículos publicados, opcionalmente filtrados por categoría.
 * El queryKey incluye la categoría para que cambiar el filtro invalide el cache.
 *
 * @param categoria - "NUTRICION" | "EJERCICIO" | "BIENESTAR" | undefined (todos)
 */
export function useArticulos(categoria?: string) {
  const params = new URLSearchParams({ page: "1", limit: "20" });
  if (categoria) params.set("categoria", categoria);

  return useQuery({
    queryKey: ["articulos", categoria ?? "todos"],
    queryFn: async () => {
      const res = await api.get<ArticulosResult>(
        `/contenido/articulos?${params.toString()}`,
      );
      return res.data;
    },
  });
}

/**
 * Devuelve el detalle completo de un artículo por ID.
 * Incluye el campo `contenido` (texto markdown completo).
 * La query se deshabilita si `id` está vacío.
 *
 * @param id - ID del artículo (cuid)
 */
export function useArticulo(id: string) {
  return useQuery({
    queryKey: ["articulo", id],
    queryFn: async () => {
      const res = await api.get<{ data: Articulo }>(
        `/contenido/articulos/${id}`,
      );
      return res.data.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Devuelve los documentos PDF/.docx publicados.
 * El campo `contenido` (texto extraído) se omite en el listado.
 * Para descargar el archivo original: GET /contenido/documentos/:id/descargar
 */
export function useDocumentos() {
  return useQuery({
    queryKey: ["documentos"],
    queryFn: async () => {
      const res = await api.get<DocumentosResult>(
        `/contenido/documentos?page=1&limit=20`,
      );
      return res.data;
    },
  });
}

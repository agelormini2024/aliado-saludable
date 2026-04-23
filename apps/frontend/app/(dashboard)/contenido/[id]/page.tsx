/**
 * ArticuloDetallePage — muestra el contenido completo de un artículo.
 *
 * Usa useParams de next/navigation para leer el ID dinámico de la ruta.
 * El campo `contenido` es texto markdown — se renderiza sin librerías externas:
 * se divide por párrafos dobles (\n\n) y cada uno se muestra con white-space
 * pre-wrap para respetar los saltos de línea internos.
 *
 * Si el artículo no existe o la API devuelve error, muestra un estado de error
 * con un botón para volver a /contenido.
 */
"use client";

import { useParams, useRouter } from "next/navigation";
import { useArticulo } from "@/hooks/useContenido";
import type { CategoriaArticulo } from "@/hooks/useContenido";

/* ─── Constantes ────────────────────────────────────────────────────────────── */

const CATEGORIA_META: Record<
  CategoriaArticulo,
  { label: string; badge: string }
> = {
  NUTRICION: { label: "Nutrición", badge: "bg-forest-pale text-forest" },
  EJERCICIO: { label: "Ejercicio", badge: "bg-amber-pale text-amber" },
  BIENESTAR: { label: "Bienestar", badge: "bg-cream-dark text-ink-muted" },
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

/** Fecha en formato largo: "23 de abril de 2026" */
function formatFechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/* ─── Skeleton ──────────────────────────────────────────────────────────────── */

function ArticuloSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-5 w-24 rounded-full bg-cream-dark" />
      <div className="space-y-3">
        <div className="h-10 w-3/4 rounded-xl bg-cream-dark" />
        <div className="h-4 w-40 rounded bg-cream-dark/60" />
      </div>
      <div className="space-y-3 rounded-2xl border border-cream-dark bg-white/60 p-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`h-4 rounded bg-cream-dark/60 ${
              i % 4 === 3 ? "w-2/3" : "w-full"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Renderizado de markdown básico ────────────────────────────────────────── */

/**
 * ContenidoMarkdown — renderiza texto markdown básico sin librerías.
 *
 * Divide por párrafos dobles (\n\n) y aplica white-space: pre-wrap para
 * respetar saltos de línea simples internos. Los símbolos de markdown
 * (# * ` - >) son visibles — si se quiere un renderizado más rico,
 * se puede agregar react-markdown en el futuro sin cambiar la estructura.
 */
function ContenidoMarkdown({ texto }: { texto: string }) {
  const parrafos = texto.split(/\n\n+/).filter(Boolean);

  return (
    <div className="space-y-5">
      {parrafos.map((parrafo, i) => (
        <p
          key={i}
          className="whitespace-pre-wrap font-sans text-base leading-relaxed text-ink"
        >
          {parrafo}
        </p>
      ))}
    </div>
  );
}

/* ─── Página de detalle ─────────────────────────────────────────────────────── */

export default function ArticuloDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: articulo, isLoading, isError } = useArticulo(id);

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-6 py-4">
        <ArticuloSkeleton />
      </div>
    );
  }

  /* ── Error o no encontrado ── */
  if (isError || !articulo) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-forest-pale">
          <svg
            className="h-7 w-7 text-forest"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="font-heading italic text-xl text-forest">
          Artículo no encontrado
        </p>
        <p className="mt-2 max-w-xs font-sans text-sm text-ink-muted">
          El artículo que buscás no existe o fue eliminado.
        </p>
        <button
          onClick={() => router.push("/contenido")}
          className="mt-6 rounded-full bg-forest px-6 py-2.5 font-sans text-sm font-medium text-cream transition-all hover:bg-forest-mid"
        >
          Volver al contenido
        </button>
      </div>
    );
  }

  const catMeta = CATEGORIA_META[articulo.categoria] ?? {
    label: articulo.categoria,
    badge: "bg-cream-dark text-ink-muted",
  };

  return (
    <div className="max-w-3xl animate-fade-in space-y-8">
      {/* Botón volver */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 font-sans text-sm text-ink-muted transition-colors hover:text-forest"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
            clipRule="evenodd"
          />
        </svg>
        Volver
      </button>

      {/* Cabecera */}
      <header className="space-y-3">
        <span
          className={`inline-block rounded-full px-3 py-1 font-sans text-xs font-semibold ${catMeta.badge}`}
        >
          {catMeta.label}
        </span>
        <h1 className="font-heading italic text-4xl font-semibold leading-tight text-forest">
          {articulo.titulo}
        </h1>
        <p className="font-sans text-sm text-ink-muted">
          {formatFechaLarga(articulo.createdAt)}
        </p>
      </header>

      {/* Separador decorativo */}
      <div className="border-t border-cream-dark" />

      {/* Cuerpo del artículo */}
      <article className="rounded-2xl border border-cream-dark bg-white/60 p-8">
        <ContenidoMarkdown texto={articulo.contenido} />
      </article>
    </div>
  );
}

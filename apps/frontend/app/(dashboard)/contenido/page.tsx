/**
 * ContenidoPage — biblioteca de artículos y documentos descargables.
 *
 * Usuarios: leen artículos publicados y descargan documentos.
 * Admin: además puede crear, editar y eliminar artículos; subir, publicar
 * y eliminar documentos. Los controles se muestran condicionalmente según
 * el rol leído desde useAuthStore.
 *
 * Los modales se controlan desde ContenidoPage para evitar problemas de
 * stacking context CSS con el overlay sobre el sidebar.
 */
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useArticulos, useDocumentos } from "@/hooks/useContenido";
import type { Articulo, Documento, CategoriaArticulo } from "@/hooks/useContenido";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";

/* ─── Schema del formulario de artículo ─────────────────────────────────────── */

const articuloSchema = z.object({
  titulo: z
    .string()
    .min(1, "El título es requerido")
    .max(200, "Máximo 200 caracteres"),
  contenido: z.string().min(1, "El contenido es requerido"),
  categoria: z.enum(["NUTRICION", "EJERCICIO", "BIENESTAR"], {
    required_error: "Seleccioná una categoría",
  }),
  publicado: z.boolean().default(false),
});

type ArticuloFormData = z.infer<typeof articuloSchema>;

/* ─── Tipo discriminado del modal de artículo ───────────────────────────────── */

/**
 * Cuando `modo === "editar"`, el campo `articulo` siempre está presente
 * para poblar el formulario y construir la URL del PATCH.
 */
type ModalArticuloState =
  | { open: false }
  | { open: true; modo: "crear" }
  | { open: true; modo: "editar"; articulo: Articulo };

/* ─── Constantes ────────────────────────────────────────────────────────────── */

const CATEGORIAS_FILTRO: { value: string | undefined; label: string }[] = [
  { value: undefined, label: "Todos" },
  { value: "NUTRICION", label: "Nutrición" },
  { value: "EJERCICIO", label: "Ejercicio" },
  { value: "BIENESTAR", label: "Bienestar" },
];

const CATEGORIAS_FORM = [
  { value: "NUTRICION" as const, label: "Nutrición" },
  { value: "EJERCICIO" as const, label: "Ejercicio" },
  { value: "BIENESTAR" as const, label: "Bienestar" },
];

const CATEGORIA_META: Record<CategoriaArticulo, { label: string; badge: string }> = {
  NUTRICION: { label: "Nutrición", badge: "bg-forest-pale text-forest" },
  EJERCICIO: { label: "Ejercicio", badge: "bg-amber-pale text-amber" },
  BIENESTAR: { label: "Bienestar", badge: "bg-cream-dark text-ink-muted" },
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function getExcerpt(texto: string, maxLen = 120): string {
  const limpio = texto
    .replace(/#{1,6}\s+/g, "")
    .replace(/[*_`>]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .trim();
  return limpio.length > maxLen ? limpio.slice(0, maxLen).trimEnd() + "…" : limpio;
}

function getMimeLabel(mimeType: string): "PDF" | "DOCX" {
  return mimeType.includes("pdf") ? "PDF" : "DOCX";
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-cream-dark/60 ${className}`} />;
}

/* ─── Clase base de inputs ───────────────────────────────────────────────────── */

const inputBase =
  "w-full rounded-xl border border-cream-dark bg-white/60 px-4 py-3 font-sans text-sm text-ink outline-none transition-all placeholder:text-ink-muted/40 focus:border-forest-mid focus:bg-white focus:shadow-[0_0_0_3px_#1E563118]";

/* ─── Campo de formulario ────────────────────────────────────────────────────── */

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
    <div>
      <label className="mb-1.5 block font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">
        {label}
      </label>
      {children}
      {error && <p className="mt-1.5 font-sans text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ─── Estado vacío ──────────────────────────────────────────────────────────── */

function EmptyState({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-cream-dark bg-white/60 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-forest-pale">
        <svg className="h-7 w-7 text-forest" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <p className="font-heading italic text-lg text-forest">{titulo}</p>
      <p className="mt-1 max-w-xs font-sans text-xs text-ink-muted">{descripcion}</p>
    </div>
  );
}

/* ─── Botón X para cerrar modales ───────────────────────────────────────────── */

function BtnCerrar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-cream-dark hover:text-ink"
    >
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </button>
  );
}

/* ─── Modal: crear / editar artículo ────────────────────────────────────────── */

/**
 * ModalArticulo — formulario flotante para crear o editar un artículo.
 *
 * POST /contenido/articulos       → crear
 * PATCH /contenido/articulos/:id  → editar
 *
 * Invalida ["articulos"] al completar para refrescar el grid.
 */
function ModalArticulo({
  modo,
  inicial,
  onClose,
}: {
  modo: "crear" | "editar";
  inicial?: Articulo;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, control, formState: { errors } } = useForm<ArticuloFormData>({
    resolver: zodResolver(articuloSchema),
    defaultValues: {
      titulo: inicial?.titulo ?? "",
      contenido: inicial?.contenido ?? "",
      categoria: inicial?.categoria,
      publicado: inicial?.publicado ?? false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ArticuloFormData) =>
      modo === "crear"
        ? api.post("/contenido/articulos", data)
        : api.patch(`/contenido/articulos/${inicial!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articulos"] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-cream-dark bg-cream p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading italic text-xl text-forest">
            {modo === "crear" ? "Nuevo artículo" : "Editar artículo"}
          </h2>
          <BtnCerrar onClick={onClose} />
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          <Field label="Título" error={errors.titulo?.message}>
            <input
              type="text"
              placeholder="Ej: Cómo mejorar tu alimentación sin sacrificar sabor"
              className={inputBase}
              {...register("titulo")}
            />
          </Field>

          <div>
            <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted">
              Categoría
            </p>
            <Controller
              name="categoria"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIAS_FORM.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => field.onChange(value)}
                      className={`rounded-xl border py-2.5 font-sans text-sm font-medium transition-all duration-150 ${
                        field.value === value
                          ? "border-forest bg-forest text-cream shadow-sm"
                          : "border-cream-dark bg-white/60 text-ink-muted hover:border-forest/40 hover:text-forest"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            />
            {errors.categoria && (
              <p className="mt-1.5 font-sans text-xs text-red-500">{errors.categoria.message}</p>
            )}
          </div>

          <Field label="Contenido (Markdown)" error={errors.contenido?.message}>
            <textarea
              rows={10}
              placeholder="Escribí el artículo en formato Markdown…"
              className={`${inputBase} resize-y`}
              {...register("contenido")}
            />
          </Field>

          {/* Toggle publicado */}
          <div className="flex items-center gap-3">
            <Controller
              name="publicado"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  onClick={() => field.onChange(!field.value)}
                  className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
                    field.value ? "bg-forest" : "bg-cream-dark"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                      field.value ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              )}
            />
            <span className="font-sans text-sm text-ink-muted">Publicar inmediatamente</span>
          </div>

          {mutation.isError && (
            <p className="rounded-xl bg-red-50 px-4 py-3 font-sans text-xs text-red-600">
              Ocurrió un error. Verificá tu conexión e intentá de nuevo.
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="flex-1 rounded-full border border-cream-dark py-3 font-sans text-sm font-medium text-ink-muted transition-all hover:bg-cream-dark disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-full bg-forest py-3 font-sans text-sm font-medium text-cream transition-all hover:bg-forest-mid disabled:opacity-60"
            >
              {mutation.isPending
                ? "Guardando…"
                : modo === "crear"
                ? "Crear artículo"
                : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Modal: subir documento ─────────────────────────────────────────────────── */

/**
 * ModalSubirDocumento — permite al admin subir un PDF o DOCX.
 *
 * Envía multipart/form-data con el campo "archivo".
 * `Content-Type: undefined` fuerza a Axios a no sobreescribir el header
 * con "application/json" del default de la instancia — el navegador lo
 * establece automáticamente con el boundary correcto al detectar FormData.
 *
 * POST /contenido/documentos → invalida ["documentos"] al completar.
 */
function ModalSubirDocumento({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [archivo, setArchivo] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!archivo) throw new Error("Sin archivo");

      // Usamos fetch nativo en lugar de Axios porque la instancia de Axios tiene
      // "Content-Type: application/json" como default de instancia y no lo limpia
      // automáticamente para FormData — lo que hace que Multer no pueda parsear el body.
      // fetch sin Content-Type deja que el browser establezca multipart/form-data con
      // el boundary correcto.
      let token: string | null = null;
      try {
        const stored = localStorage.getItem("aliado-auth");
        if (stored) {
          const parsed = JSON.parse(stored) as { state: { accessToken: string | null } };
          token = parsed.state.accessToken;
        }
      } catch { /* storage corrupto */ }

      const formData = new FormData();
      formData.append("archivo", archivo);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const res = await fetch(`${apiUrl}/contenido/documentos`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-cream-dark bg-cream p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading italic text-xl text-forest">Subir documento</h2>
          <BtnCerrar onClick={onClose} />
        </div>

        {/* Zona de selección */}
        <div
          onClick={() => inputRef.current?.click()}
          className="mb-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-cream-dark bg-white/60 py-10 text-center transition-colors hover:border-forest/40"
        >
          <svg className="mb-3 h-10 w-10 text-ink-muted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          {archivo ? (
            <p className="font-sans text-sm font-medium text-forest">{archivo.name}</p>
          ) : (
            <>
              <p className="font-sans text-sm text-ink-muted">
                Hacé click para seleccionar un archivo
              </p>
              <p className="mt-1 font-sans text-xs text-ink-muted/60">
                PDF o DOCX · máximo 20 MB
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setArchivo(f);
            }}
          />
        </div>

        {mutation.isError && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 font-sans text-xs text-red-600">
            Error al subir el archivo. Verificá el formato (PDF o DOCX) y el tamaño (máx. 20 MB).
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1 rounded-full border border-cream-dark py-3 font-sans text-sm font-medium text-ink-muted transition-all hover:bg-cream-dark disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!archivo || mutation.isPending}
            className="flex-1 rounded-full bg-forest py-3 font-sans text-sm font-medium text-cream transition-all hover:bg-forest-mid disabled:opacity-60"
          >
            {mutation.isPending ? "Subiendo…" : "Subir documento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Card de artículo ──────────────────────────────────────────────────────── */

/**
 * ArticuloCard — muestra título, categoría, excerpt y fecha.
 *
 * Admin ve además una barra de acciones: Editar | Eliminar (con confirm inline).
 * El área de contenido y los botones admin son elementos separados para evitar
 * botones anidados (HTML inválido).
 */
function ArticuloCard({
  articulo,
  esAdmin,
  onClick,
  onEditar,
  onEliminar,
}: {
  articulo: Articulo;
  esAdmin: boolean;
  onClick: () => void;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const meta = CATEGORIA_META[articulo.categoria] ?? {
    label: articulo.categoria,
    badge: "bg-cream-dark text-ink-muted",
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-cream-dark bg-white/60 transition-all duration-200 hover:border-forest/30 hover:shadow-md">
      {/* Área clickable */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        className="flex flex-1 cursor-pointer flex-col p-5"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 font-sans text-xs font-semibold ${meta.badge}`}>
            {meta.label}
          </span>
          {esAdmin && !articulo.publicado && (
            <span className="rounded-full bg-ink/10 px-2 py-0.5 font-sans text-xs text-ink-muted">
              Borrador
            </span>
          )}
        </div>

        <h3 className="mb-2 font-heading italic text-lg leading-snug text-forest transition-colors group-hover:text-forest-mid">
          {articulo.titulo}
        </h3>

        <p className="mb-4 flex-1 font-sans text-sm leading-relaxed text-ink-muted">
          {getExcerpt(articulo.contenido)}
        </p>

        <div className="flex items-center justify-between">
          <span className="font-sans text-xs text-ink-muted/60">
            {formatFecha(articulo.createdAt)}
          </span>
          <span className="font-sans text-xs font-medium text-forest opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            Leer →
          </span>
        </div>
      </div>

      {/* Barra de acciones admin */}
      {esAdmin && (
        <div className="flex items-center justify-end gap-2 border-t border-cream-dark/60 px-5 py-2.5">
          {confirmDelete ? (
            <>
              <span className="mr-1 font-sans text-xs text-ink-muted">¿Eliminar?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-full border border-cream-dark px-3 py-1 font-sans text-xs text-ink-muted transition-colors hover:text-ink"
              >
                No
              </button>
              <button
                onClick={() => { onEliminar(); setConfirmDelete(false); }}
                className="rounded-full bg-red-500 px-3 py-1 font-sans text-xs font-medium text-white transition-colors hover:bg-red-600"
              >
                Sí, eliminar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onEditar}
                className="rounded-full border border-cream-dark px-3 py-1 font-sans text-xs text-ink-muted transition-colors hover:border-forest/40 hover:text-forest"
              >
                Editar
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-full border border-red-200 px-3 py-1 font-sans text-xs text-red-500 transition-colors hover:border-red-400 hover:text-red-700"
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Tab: Artículos ────────────────────────────────────────────────────────── */

function TabArticulos({
  esAdmin,
  onNuevo,
  onEditar,
}: {
  esAdmin: boolean;
  onNuevo: () => void;
  onEditar: (art: Articulo) => void;
}) {
  const queryClient = useQueryClient();
  const [categoria, setCategoria] = useState<string | undefined>(undefined);
  const { data, isLoading } = useArticulos(categoria);
  const router = useRouter();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/contenido/articulos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["articulos"] }),
  });

  return (
    <div className="space-y-6">
      {/* Filtros + botón nuevo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS_FILTRO.map(({ value, label }) => (
            <button
              key={label}
              onClick={() => setCategoria(value)}
              className={`rounded-full px-4 py-1.5 font-sans text-sm font-medium transition-all duration-150 ${
                categoria === value
                  ? "bg-forest text-cream shadow-sm"
                  : "border border-cream-dark bg-white/60 text-ink-muted hover:border-forest/40 hover:text-forest"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {esAdmin && (
          <button
            onClick={onNuevo}
            className="rounded-full bg-amber px-5 py-1.5 font-sans text-sm font-medium text-cream transition-all hover:bg-amber-light"
          >
            + Nuevo artículo
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          titulo="Sin artículos todavía"
          descripcion={
            esAdmin
              ? "Creá el primer artículo con el botón \"+ Nuevo artículo\"."
              : "Cuando el equipo publique contenido, va a aparecer acá."
          }
        />
      ) : (
        <div className="grid animate-fade-in grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((art) => (
            <ArticuloCard
              key={art.id}
              articulo={art}
              esAdmin={esAdmin}
              onClick={() => router.push(`/contenido/${art.id}`)}
              onEditar={() => onEditar(art)}
              onEliminar={() => deleteMutation.mutate(art.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Fila de documento ─────────────────────────────────────────────────────── */

/**
 * DocumentoRow — muestra nombre, tipo, fecha y controles de descarga.
 *
 * Admin ve además un toggle de publicación y un botón eliminar con confirm inline.
 */
function DocumentoRow({
  doc,
  esAdmin,
  downloading,
  onDescargar,
  onTogglePublicado,
  onEliminar,
}: {
  doc: Documento;
  esAdmin: boolean;
  downloading: boolean;
  onDescargar: () => void;
  onTogglePublicado: () => void;
  onEliminar: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tipo = getMimeLabel(doc.mimeType);
  const esPdf = tipo === "PDF";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-cream-dark bg-white/60 px-5 py-4">
      {/* Badge tipo */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-sans text-xs font-bold ${
          esPdf ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-600"
        }`}
      >
        {tipo}
      </div>

      {/* Nombre y fecha */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-sm font-medium text-ink">{doc.nombre}</p>
        <p className="font-sans text-xs text-ink-muted">{formatFecha(doc.createdAt)}</p>
      </div>

      {/* Toggle publicado — solo admin */}
      {esAdmin && (
        <button
          onClick={onTogglePublicado}
          className={`shrink-0 rounded-full px-3 py-1 font-sans text-xs font-medium transition-colors ${
            doc.publicado
              ? "bg-forest-pale text-forest hover:bg-forest-pale/70"
              : "bg-cream-dark text-ink-muted hover:bg-cream-dark/70"
          }`}
        >
          {doc.publicado ? "Publicado" : "Borrador"}
        </button>
      )}

      {/* Descargar */}
      <button
        onClick={onDescargar}
        disabled={downloading}
        className="shrink-0 rounded-full bg-forest px-4 py-1.5 font-sans text-xs font-medium text-cream transition-all hover:bg-forest-mid disabled:opacity-60"
      >
        {downloading ? "Descargando…" : "Descargar"}
      </button>

      {/* Eliminar — solo admin */}
      {esAdmin && (
        confirmDelete ? (
          <>
            <span className="font-sans text-xs text-ink-muted">¿Eliminar?</span>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-full border border-cream-dark px-3 py-1 font-sans text-xs text-ink-muted hover:text-ink"
            >
              No
            </button>
            <button
              onClick={() => { onEliminar(); setConfirmDelete(false); }}
              className="rounded-full bg-red-500 px-3 py-1 font-sans text-xs font-medium text-white hover:bg-red-600"
            >
              Sí
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="shrink-0 rounded-full border border-red-200 px-3 py-1 font-sans text-xs text-red-500 transition-colors hover:border-red-400"
          >
            Eliminar
          </button>
        )
      )}
    </div>
  );
}

/* ─── Tab: Documentos ───────────────────────────────────────────────────────── */

function TabDocumentos({
  esAdmin,
  onSubir,
}: {
  esAdmin: boolean;
  onSubir: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useDocumentos();
  const [downloading, setDownloading] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/contenido/documentos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documentos"] }),
  });

  const togglePublicadoMutation = useMutation({
    mutationFn: async ({ id, publicado }: { id: string; publicado: boolean }) =>
      api.patch(`/contenido/documentos/${id}`, { publicado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documentos"] }),
  });

  async function handleDescargar(doc: Documento) {
    setDownloading(doc.id);
    try {
      const res = await api.get(`/contenido/documentos/${doc.id}/descargar`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.nombre;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {esAdmin && (
        <div className="flex justify-end">
          <button
            onClick={onSubir}
            className="rounded-full bg-amber px-5 py-1.5 font-sans text-sm font-medium text-cream transition-all hover:bg-amber-light"
          >
            + Subir documento
          </button>
        </div>
      )}

      {!data?.items.length ? (
        <EmptyState
          titulo="Sin documentos todavía"
          descripcion={
            esAdmin
              ? "Subí el primer documento con el botón \"+ Subir documento\"."
              : "El equipo puede subir guías en PDF o DOCX para que las descargues acá."
          }
        />
      ) : (
        <div className="animate-fade-in space-y-3">
          {data.items.map((doc) => (
            <DocumentoRow
              key={doc.id}
              doc={doc}
              esAdmin={esAdmin}
              downloading={downloading === doc.id}
              onDescargar={() => handleDescargar(doc)}
              onTogglePublicado={() =>
                togglePublicadoMutation.mutate({ id: doc.id, publicado: !doc.publicado })
              }
              onEliminar={() => deleteMutation.mutate(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Página principal ─────────────────────────────────────────────────────── */

type Tab = "articulos" | "documentos";

export default function ContenidoPage() {
  const [tab, setTab] = useState<Tab>("articulos");
  const usuario = useAuthStore((s) => s.usuario);
  const esAdmin = usuario?.rol === "ADMIN";

  const [modalArticulo, setModalArticulo] = useState<ModalArticuloState>({ open: false });
  const [modalDocumento, setModalDocumento] = useState(false);

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-widest text-amber">
          Recursos
        </p>
        <h1 className="font-heading italic text-4xl font-semibold leading-tight text-forest">
          Contenido
        </h1>
        <p className="mt-1 font-sans text-sm text-ink-muted">
          Artículos y guías para tu bienestar
        </p>
      </header>

      {/* Tabs */}
      <div className="border-b border-cream-dark">
        <div className="flex gap-6">
          {(["articulos", "documentos"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 font-sans text-sm font-medium transition-colors ${
                tab === t
                  ? "-mb-px border-b-2 border-amber text-ink"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {t === "articulos" ? "Artículos" : "Documentos"}
            </button>
          ))}
        </div>
      </div>

      {tab === "articulos" ? (
        <TabArticulos
          esAdmin={esAdmin}
          onNuevo={() => setModalArticulo({ open: true, modo: "crear" })}
          onEditar={(art) => setModalArticulo({ open: true, modo: "editar", articulo: art })}
        />
      ) : (
        <TabDocumentos esAdmin={esAdmin} onSubir={() => setModalDocumento(true)} />
      )}

      {/* Modal artículo */}
      {modalArticulo.open && (
        <ModalArticulo
          modo={modalArticulo.modo}
          inicial={modalArticulo.modo === "editar" ? modalArticulo.articulo : undefined}
          onClose={() => setModalArticulo({ open: false })}
        />
      )}

      {/* Modal subir documento */}
      {modalDocumento && (
        <ModalSubirDocumento onClose={() => setModalDocumento(false)} />
      )}
    </div>
  );
}

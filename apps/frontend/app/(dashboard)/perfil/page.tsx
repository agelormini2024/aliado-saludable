/**
 * PerfilPage — visualización y edición del perfil del usuario.
 *
 * Muestra los datos de identidad del usuario (nombre, email, rol) en modo
 * lectura, y permite actualizar los datos físicos relevantes para el seguimiento:
 * altura y peso objetivo (meta).
 *
 * PATCH /usuarios/me → actualiza altura y meta en el backend.
 * Tras guardar, el store de Zustand se sincroniza para que el sidebar
 * y otros componentes reflejen los nuevos valores sin recargar.
 */
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";

/* ─── Schema de validación ─────────────────────────────────────────────────── */

/**
 * Preprocessing para campos numéricos opcionales.
 * Convierte string vacío/undefined/null → undefined, igual que en ProgresoPage.
 */
const optionalPositiveFloat = z.preprocess(
  (val) => {
    if (val === "" || val === undefined || val === null) return undefined;
    const n = Number(val);
    return isNaN(n) ? undefined : n;
  },
  z.number().positive("Debe ser un número positivo").optional(),
);

const perfilSchema = z.object({
  altura: optionalPositiveFloat,
  meta: optionalPositiveFloat,
});

type PerfilFormData = z.infer<typeof perfilSchema>;

/* ─── Helpers de presentación ──────────────────────────────────────────────── */

const ROL_LABEL: Record<string, string> = {
  USUARIO: "Usuario",
  COACH: "Coach",
  ADMIN: "Administrador",
};

/* ─── Componente principal ─────────────────────────────────────────────────── */

export default function PerfilPage() {
  const { usuario, setUsuario } = useAuthStore();
  const [exito, setExito] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PerfilFormData>({
    resolver: zodResolver(perfilSchema),
    defaultValues: {
      altura: usuario?.altura ?? undefined,
      meta: usuario?.meta ?? undefined,
    },
  });

  const onSubmit = async (data: PerfilFormData) => {
    setGuardando(true);
    setExito(false);
    setErrorMsg(null);

    try {
      const res = await api.patch<{ data: typeof usuario }>("/usuarios/me", {
        ...(data.altura !== undefined ? { altura: data.altura } : {}),
        ...(data.meta !== undefined ? { meta: data.meta } : {}),
      });

      if (res.data.data) {
        setUsuario({
          id: res.data.data.id!,
          nombre: res.data.data.nombre!,
          apellido: res.data.data.apellido!,
          email: res.data.data.email!,
          rol: res.data.data.rol as "USUARIO" | "COACH" | "ADMIN",
          altura: res.data.data.altura,
          meta: res.data.data.meta,
          coachId: res.data.data.coachId,
        });
      }

      setExito(true);
    } catch {
      setErrorMsg("No se pudo guardar el perfil. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  if (!usuario) return null;

  const iniciales = `${usuario.nombre[0]}${usuario.apellido[0]}`.toUpperCase();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 lg:px-0">

      {/* ── Encabezado ── */}
      <div>
        <h1 className="font-[Fraunces] text-2xl italic text-[#2d4a3e]">
          Mi perfil
        </h1>
        <p className="mt-1 text-sm text-[#6b7a6e]">
          Tu información personal y objetivos de salud.
        </p>
      </div>

      {/* ── Tarjeta de identidad (solo lectura) ── */}
      <div className="rounded-2xl border border-[#e8e4dc] bg-white/60 p-6">
        <div className="flex items-center gap-4">
          {/* Avatar con iniciales */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#2d4a3e] text-xl font-semibold text-[#faf8f4]">
            {iniciales}
          </div>

          <div className="min-w-0">
            <p className="font-[Fraunces] text-xl text-[#2d4a3e]">
              {usuario.nombre} {usuario.apellido}
            </p>
            <p className="truncate text-sm text-[#6b7a6e]">{usuario.email}</p>
            <span className="mt-1 inline-block rounded-full bg-[#e8f0eb] px-3 py-0.5 text-xs font-medium text-[#2d4a3e]">
              {ROL_LABEL[usuario.rol] ?? usuario.rol}
            </span>
          </div>
        </div>
      </div>

      {/* ── Formulario de datos físicos ── */}
      <div className="rounded-2xl border border-[#e8e4dc] bg-white/60 p-6">
        <h2 className="mb-1 font-[Fraunces] text-lg italic text-[#2d4a3e]">
          Datos físicos
        </h2>
        <p className="mb-5 text-xs text-[#6b7a6e]">
          Usados para calcular tu progreso y personalizar las recomendaciones del chat IA.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* Altura */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-[#6b7a6e]">
              Altura (cm)
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="Ej: 170"
              {...register("altura")}
              className="w-full rounded-xl border border-[#e8e4dc] bg-white px-4 py-3 text-sm text-[#2d4a3e] outline-none transition focus:border-[#2d4a3e] focus:ring-2 focus:ring-[#2d4a3e]/10"
            />
            {errors.altura && (
              <p className="mt-1.5 text-xs text-red-500">{errors.altura.message}</p>
            )}
          </div>

          {/* Meta (peso objetivo) */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-[#6b7a6e]">
              Peso objetivo (kg)
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="Ej: 75"
              {...register("meta")}
              className="w-full rounded-xl border border-[#e8e4dc] bg-white px-4 py-3 text-sm text-[#2d4a3e] outline-none transition focus:border-[#2d4a3e] focus:ring-2 focus:ring-[#2d4a3e]/10"
            />
            {errors.meta && (
              <p className="mt-1.5 text-xs text-red-500">{errors.meta.message}</p>
            )}
          </div>

          {/* Feedback */}
          {exito && (
            <p className="rounded-xl bg-[#e8f0eb] px-4 py-3 text-sm text-[#2d4a3e]">
              ✓ Perfil actualizado correctamente.
            </p>
          )}
          {errorMsg && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={guardando}
            className="w-full rounded-xl bg-[#2d4a3e] py-3 text-sm font-semibold text-[#faf8f4] transition hover:bg-[#3d6457] disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </div>
    </div>
  );
}
